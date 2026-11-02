import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  JwtAuthGuard,
  type AuthenticatedRequest,
} from '../auth/guards/jwt-auth.guard.js';
import { PoiAdminGuard } from '../auth/guards/poi-admin.guard.js';
import { SignedUrlService } from '../common/signed-url/signed-url.service.js';
import { PlaceClosureService } from './place-closure.service.js';
import { RequestClosureDto } from './dto/request-closure.dto.js';

// Long enough for a big ZIP to start on a slow line; useless afterwards.
const EXPORT_LINK_SECONDS = 60 * 60;

function exportPath(poiId: string): string {
  return `/place-export/${poiId}`;
}

/**
 * Settings › Account in the admin: the place's data as one ZIP, and
 * closing the place's account (or taking the closing back).
 */
@Controller('pois/:poiId/closure')
@UseGuards(JwtAuthGuard, PoiAdminGuard)
export class PlaceClosureController {
  constructor(
    private readonly closure: PlaceClosureService,
    private readonly signedUrls: SignedUrlService,
  ) {}

  @Get()
  status(
    @Param('poiId', ParseUUIDPipe) poiId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.closure.status(poiId, req.userId);
  }

  @Post()
  @HttpCode(200)
  request(
    @Param('poiId', ParseUUIDPipe) poiId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: RequestClosureDto,
  ) {
    return this.closure.request(poiId, req.userId, dto, req);
  }

  // "Keep my place".
  @Delete()
  cancel(
    @Param('poiId', ParseUUIDPipe) poiId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.closure.cancel(poiId, req.userId, req);
  }

  // The browser downloads the ZIP itself, so it gets a signed link.
  @Post('export-link')
  @HttpCode(200)
  exportLink(@Param('poiId', ParseUUIDPipe) poiId: string) {
    return {
      url: this.signedUrls.sign(exportPath(poiId), EXPORT_LINK_SECONDS),
    };
  }
}

@Controller('place-export')
export class PlaceExportController {
  constructor(
    private readonly closure: PlaceClosureService,
    private readonly signedUrls: SignedUrlService,
  ) {}

  @Get(':poiId')
  async download(
    @Param('poiId', ParseUUIDPipe) poiId: string,
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    if (!this.signedUrls.verify(exportPath(poiId), exp, sig)) {
      throw new ForbiddenException('This link has expired');
    }
    const { name, data } = await this.closure.exportZip(poiId);
    response.setHeader('Content-Type', 'application/zip');
    response.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    response.setHeader('Cache-Control', 'private, no-store');
    response.send(data);
  }
}
