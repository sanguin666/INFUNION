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
import { PrivacyService } from './privacy.service.js';
import { RecordConsentDto } from './dto/record-consent.dto.js';

// Long enough to open on a slow phone, short enough to be useless later.
const EXPORT_LINK_SECONDS = 10 * 60;

/** The path an export link signs — the part before `?`. */
function exportPath(userId: string): string {
  return `/privacy/export/${userId}`;
}

/**
 * The person's own side, from the app's profile screen: accept the terms,
 * get a copy of their data, delete their account.
 */
@Controller('auth/me')
@UseGuards(JwtAuthGuard)
export class MyPrivacyController {
  constructor(
    private readonly privacy: PrivacyService,
    private readonly signedUrls: SignedUrlService,
  ) {}

  @Post('consent')
  @HttpCode(204)
  consent(@Req() req: AuthenticatedRequest, @Body() dto: RecordConsentDto) {
    return this.privacy.recordConsent(req.userId, dto.version);
  }

  /**
   * The copy opens in the phone's browser, which can't send the token, so
   * the app is handed a short-lived signed link instead (relative, like
   * every signed link: the app puts its own API address in front).
   */
  @Post('export-link')
  exportLink(@Req() req: AuthenticatedRequest) {
    return {
      url: this.signedUrls.sign(exportPath(req.userId), EXPORT_LINK_SECONDS),
    };
  }

  @Delete()
  @HttpCode(204)
  deleteAccount(@Req() req: AuthenticatedRequest) {
    return this.privacy.deleteAccount(req.userId);
  }
}

/** Where an export link lands: the signature is the only check. */
@Controller('privacy')
export class PrivacyExportController {
  constructor(
    private readonly privacy: PrivacyService,
    private readonly signedUrls: SignedUrlService,
  ) {}

  @Get('export/:userId')
  async export(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    if (!this.signedUrls.verify(exportPath(userId), exp, sig)) {
      throw new ForbiddenException('This link has expired');
    }
    const data = await this.privacy.exportFor(userId);
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="infunion-my-data.json"',
    );
    response.setHeader('Cache-Control', 'private, no-store');
    response.type('application/json').send(JSON.stringify(data, null, 2));
  }
}

/**
 * The office answering a member who asks it directly: a copy of what they
 * did in this place, or its erasure. Beside the Membres page's own routes.
 */
@Controller('pois/:poiId/members')
@UseGuards(JwtAuthGuard, PoiAdminGuard)
export class MemberPrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Get(':userId/export')
  export(
    @Param('poiId') poiId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.privacy.exportFor(userId, poiId);
  }

  @Delete(':userId')
  @HttpCode(204)
  remove(
    @Param('poiId') poiId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.privacy.removeMemberFromPlace(poiId, userId, req.userId);
  }
}
