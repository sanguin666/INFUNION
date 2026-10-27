import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { memoryStorage } from 'multer';
import {
  assetHash,
  hasAsset,
  openAsset,
  isAssetHash,
  isPlatform,
  isRuntimeVersion,
  latestRelease,
  saveAsset,
  saveRelease,
  updateIdFor,
  type StoredUpdate,
  type UpdateAsset,
} from './app-updates.store.js';
import { MissingAssetsDto, PublishUpdateDto } from './dto/publish-update.dto.js';

// The JS bundle is the biggest file of an update, a few MB.
const MAX_ASSET_BYTES = 50 * 1024 * 1024;

/**
 * Over-the-air updates for the app, served the way expo-updates asks for
 * them (https://docs.expo.dev/technical-specs/expo-updates-1/), so new
 * screens reach phones without a new APK or a store review.
 *
 * Reading is public: it is the same code anyone can download in the APK.
 * Publishing takes APP_UPDATES_TOKEN, which only the GitHub workflow has
 * (see app/scripts/publish-update.mjs).
 *
 * Only an update built for the exact native build on the phone (its
 * "runtime version", a fingerprint of the native side) is ever offered, so
 * new JS can't land on an APK that lacks a native module it needs. Those
 * phones are told to install the new APK instead (app/src/updates).
 */
@Controller('updates')
export class AppUpdatesController {
  constructor(private readonly config: ConfigService) {}

  @Get('manifest')
  async manifest(
    @Headers('expo-platform') platformHeader: string | undefined,
    @Headers('expo-runtime-version') runtimeHeader: string | undefined,
    @Headers('expo-protocol-version') protocolHeader: string | undefined,
    @Headers('expo-current-update-id') currentUpdateId: string | undefined,
    @Query('platform') platformQuery: string | undefined,
    @Query('runtime-version') runtimeQuery: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const platform = platformHeader ?? platformQuery ?? '';
    const runtimeVersion = runtimeHeader ?? runtimeQuery ?? '';
    if (!isPlatform(platform)) throw new BadRequestException('Unknown platform');
    if (!isRuntimeVersion(runtimeVersion)) throw new BadRequestException('Unknown runtime version');
    const protocol = protocolHeader === '1' ? 1 : 0;

    const update = await latestRelease(platform, runtimeVersion);
    const upToDate = !update || update.id === currentUpdateId;
    if (upToDate && protocol === 0) {
      // Protocol 0 has no way to say "nothing new" other than not found.
      throw new NotFoundException('No update for this build');
    }

    const boundary = `infunion-${randomBytes(12).toString('hex')}`;
    const parts = upToDate
      ? [{ name: 'directive', body: { type: 'noUpdateAvailable' } }]
      : [
          { name: 'manifest', body: manifestFor(update, baseUrl(request)) },
          { name: 'extensions', body: { assetRequestHeaders: {} } },
        ];

    response.setHeader('expo-protocol-version', String(protocol));
    response.setHeader('expo-sfv-version', '0');
    response.setHeader('cache-control', 'private, max-age=0');
    response.setHeader('content-type', `multipart/mixed; boundary=${boundary}`);
    // A Buffer, not a string: Express would add "; charset=utf-8" after the
    // boundary, and the phone would then look for the wrong boundary.
    response.send(Buffer.from(multipart(boundary, parts), 'utf8'));
  }

  /** One file of an update. Named by its hash, so it never changes. */
  @Get('assets/:hash')
  async asset(
    @Param('hash') hash: string,
    @Query('type') contentType: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const file = isAssetHash(hash) ? await openAsset(hash) : null;
    if (!file) throw new NotFoundException('No such file');
    response.setHeader(
      'content-type',
      contentType && /^[\w.+-]+\/[\w.+-]+$/.test(contentType) ? contentType : 'application/octet-stream',
    );
    response.setHeader('cache-control', 'public, max-age=31536000, immutable');
    file.body.on('error', () => response.destroy());
    file.body.pipe(response);
  }

  /** Which of these files the server doesn't have yet, so only those are sent. */
  @Post('missing-assets')
  @HttpCode(200)
  async missingAssets(@Headers('authorization') authorization: string | undefined, @Body() dto: MissingAssetsDto) {
    this.checkPublisher(authorization);
    const present = await Promise.all(dto.hashes.map((hash) => hasAsset(hash)));
    return { missing: dto.hashes.filter((_hash, index) => !present[index]) };
  }

  @Put('assets/:hash')
  @HttpCode(204)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_ASSET_BYTES } }))
  async uploadAsset(
    @Headers('authorization') authorization: string | undefined,
    @Param('hash') hash: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<void> {
    this.checkPublisher(authorization);
    if (!file) throw new BadRequestException('No file uploaded');
    if (!isAssetHash(hash) || assetHash(file.buffer) !== hash) {
      throw new BadRequestException('The file does not match its hash');
    }
    await saveAsset(hash, file.buffer);
  }

  /** Makes an update the one phones on that build download next. */
  @Post('publish')
  async publish(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: PublishUpdateDto,
  ): Promise<{ id: string; runtimeVersion: string }> {
    this.checkPublisher(authorization);
    const wanted = [dto.launchAsset, ...dto.assets];
    const present = await Promise.all(wanted.map((asset) => hasAsset(asset.hash)));
    const missing = wanted.filter((_asset, index) => !present[index]);
    if (missing.length > 0) {
      throw new BadRequestException(`${missing.length} file(s) not uploaded yet`);
    }
    const content = {
      platform: dto.platform,
      runtimeVersion: dto.runtimeVersion,
      launchAsset: pickAsset(dto.launchAsset),
      assets: dto.assets.map(pickAsset),
      expoClient: dto.expoClient,
    };
    const update: StoredUpdate = {
      id: updateIdFor(content),
      createdAt: new Date().toISOString(),
      ...content,
      commit: dto.commit ?? null,
    };
    const current = await latestRelease(update.platform, update.runtimeVersion);
    // Same code again: keep the date it first went out.
    if (current?.id === update.id) return { id: current.id, runtimeVersion: current.runtimeVersion };
    await saveRelease(update);
    return { id: update.id, runtimeVersion: update.runtimeVersion };
  }

  private checkPublisher(authorization: string | undefined): void {
    const token = this.config.get<string>('APP_UPDATES_TOKEN');
    if (!token) throw new ServiceUnavailableException('Publishing updates is off: APP_UPDATES_TOKEN is not set');
    const given = Buffer.from(authorization?.replace(/^Bearer\s+/i, '') ?? '');
    const wanted = Buffer.from(token);
    if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) {
      throw new UnauthorizedException('Wrong publishing token');
    }
  }
}

function pickAsset(asset: UpdateAsset): UpdateAsset {
  return {
    hash: asset.hash,
    key: asset.key,
    contentType: asset.contentType,
    fileExtension: asset.fileExtension,
  };
}

/** The API's own address as the phone reached it, for the file links. */
function baseUrl(request: Request): string {
  // Railway ends HTTPS at its proxy and forwards plain HTTP.
  const forwarded = request.header('x-forwarded-proto')?.split(',')[0]?.trim();
  return `${forwarded || request.protocol}://${request.get('host')}`;
}

export function manifestFor(update: StoredUpdate, base: string) {
  const withUrl = (asset: UpdateAsset) => ({
    ...asset,
    url: `${base}/updates/assets/${asset.hash}?type=${encodeURIComponent(asset.contentType)}`,
  });
  return {
    id: update.id,
    createdAt: update.createdAt,
    runtimeVersion: update.runtimeVersion,
    launchAsset: withUrl(update.launchAsset),
    assets: update.assets.map(withUrl),
    metadata: {},
    extra: { expoClient: update.expoClient },
  };
}

function multipart(boundary: string, parts: { name: string; body: unknown }[]): string {
  const sections = parts.map(
    (part) =>
      `--${boundary}\r\n` +
      `content-type: application/json; charset=utf-8\r\n` +
      `content-disposition: form-data; name="${part.name}"\r\n\r\n` +
      `${JSON.stringify(part.body)}\r\n`,
  );
  return `${sections.join('')}--${boundary}--\r\n`;
}
