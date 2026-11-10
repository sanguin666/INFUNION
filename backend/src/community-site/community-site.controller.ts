import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PoiAdminGuard } from '../auth/guards/poi-admin.guard.js';
import { CommunitySiteService } from './community-site.service.js';
import { UpdateSiteDto } from './dto/update-site.dto.js';
import { renderNotFound, renderSite } from './site-render.js';

function requestBase(req: Request): string {
  return `${req.protocol}://${req.get('host') ?? 'localhost'}`;
}

/** The community's public website (#195): /c/<slug>, plain HTML. */
@Controller('c')
export class CommunitySitePublicController {
  constructor(private readonly site: CommunitySiteService) {}

  @Get(':slug')
  async page(@Param('slug') slug: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    const data = await this.site.data(slug.toLowerCase());
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // A short cache for the site; none for "not found", so publishing shows at once.
    res.setHeader('Cache-Control', data ? 'public, max-age=60' : 'no-store');
    if (!data) {
      res.status(404).send(renderNotFound(req.acceptsLanguages('en', 'es', 'fr', 'ca', 'gl', 'pt') || 'es'));
      return;
    }
    res.status(200).send(await renderSite(data, this.site.baseUrl(requestBase(req))));
  }
}

/** The website settings, for the community's admins. */
@Controller('pois/:poiId/site')
@UseGuards(JwtAuthGuard, PoiAdminGuard)
export class CommunitySiteController {
  constructor(private readonly site: CommunitySiteService) {}

  @Get()
  get(@Param('poiId', ParseUUIDPipe) poiId: string, @Req() req: Request) {
    return this.site.settings(poiId, requestBase(req));
  }

  @Patch()
  update(@Param('poiId', ParseUUIDPipe) poiId: string, @Body() dto: UpdateSiteDto, @Req() req: Request) {
    return this.site.update(poiId, dto, requestBase(req));
  }
}
