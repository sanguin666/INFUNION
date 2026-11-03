import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  JwtAuthGuard,
  type AuthenticatedRequest,
} from '../auth/guards/jwt-auth.guard.js';
import { PoiAdminGuard } from '../auth/guards/poi-admin.guard.js';
import { ModerationService } from './moderation.service.js';
import {
  CreateReportDto,
  HidePersonDto,
  ResolveReportDto,
} from './dto/moderation.dto.js';

@Controller('pois/:poiId')
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  // A member reporting a post, a reply or a prayer request.
  @Post('reports')
  @UseGuards(JwtAuthGuard)
  report(
    @Req() request: AuthenticatedRequest,
    @Param('poiId', ParseUUIDPipe) poiId: string,
    @Body() dto: CreateReportDto,
  ) {
    return this.moderation.report(poiId, request.userId, dto);
  }

  // The team: open reports, how many, and what to do with each.
  @Get('reports')
  @UseGuards(JwtAuthGuard, PoiAdminGuard)
  listOpen(
    @Param('poiId', ParseUUIDPipe) poiId: string,
    @Query('area') area?: string,
  ) {
    return this.moderation.listOpen(poiId, area === 'prayer' ? 'prayer' : 'community');
  }

  @Get('reports/count')
  @UseGuards(JwtAuthGuard, PoiAdminGuard)
  count(@Param('poiId', ParseUUIDPipe) poiId: string) {
    return this.moderation.openCount(poiId);
  }

  @Post('reports/resolve')
  @UseGuards(JwtAuthGuard, PoiAdminGuard)
  resolve(
    @Param('poiId', ParseUUIDPipe) poiId: string,
    @Body() dto: ResolveReportDto,
  ) {
    return this.moderation.resolve(poiId, dto);
  }

  @Get('posting-bans')
  @UseGuards(JwtAuthGuard, PoiAdminGuard)
  listBans(@Param('poiId', ParseUUIDPipe) poiId: string) {
    return this.moderation.listBans(poiId);
  }

  @Delete('posting-bans/:id')
  @UseGuards(JwtAuthGuard, PoiAdminGuard)
  liftBan(
    @Param('poiId', ParseUUIDPipe) poiId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.moderation.liftBan(poiId, id);
  }
}

/** Profile › Hidden people: whose posts a member chose not to see. */
@Controller('auth/me/hidden-people')
@UseGuards(JwtAuthGuard)
export class HiddenPeopleController {
  constructor(private readonly moderation: ModerationService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.moderation.listHidden(request.userId);
  }

  @Post()
  hide(@Req() request: AuthenticatedRequest, @Body() dto: HidePersonDto) {
    return this.moderation.hide(request.userId, dto);
  }

  @Delete(':id')
  unhide(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.moderation.unhide(request.userId, id);
  }
}
