import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/guards/jwt-auth.guard.js';
import { PoiAdminGuard } from '../auth/guards/poi-admin.guard.js';
import { returnUrlBase } from '../donations/donations.controller.js';
import { ContactsService } from './contacts.service.js';
import { OutreachService } from './outreach.service.js';
import { ContactDto, ImportContactsDto, OutreachDto, OutreachTestDto } from './dto/contacts.dto.js';
import type { ContactInput } from './contact-rules.js';

/** The community's own list of members, for its team (Members page). */
@Controller('pois/:poiId/contacts')
@UseGuards(JwtAuthGuard, PoiAdminGuard)
export class ContactsController {
  constructor(
    private readonly contacts: ContactsService,
    private readonly outreach: OutreachService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  list(@Param('poiId') poiId: string) {
    return this.contacts.list(poiId);
  }

  @Get('groups')
  groups(@Param('poiId') poiId: string) {
    return this.contacts.groups(poiId);
  }

  @Post('check')
  check(@Param('poiId') poiId: string, @Body() dto: ImportContactsDto) {
    return this.contacts.check(poiId, dto.rows as ContactInput[]);
  }

  @Post('import')
  import(@Param('poiId') poiId: string, @Req() req: AuthenticatedRequest, @Body() dto: ImportContactsDto) {
    // The team says these are its members and gave their details (GDPR).
    if (dto.confirmed !== true) throw new BadRequestException('confirmation_required');
    return this.contacts.import(poiId, req.userId, dto.rows as ContactInput[], dto.fileName);
  }

  @Post()
  add(@Param('poiId') poiId: string, @Req() req: AuthenticatedRequest, @Body() dto: ContactDto) {
    return this.contacts.add(poiId, req.userId, dto);
  }

  @Patch(':id')
  update(@Param('poiId') poiId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ContactDto) {
    return this.contacts.update(poiId, id, dto);
  }

  @Delete(':id')
  remove(@Param('poiId') poiId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.contacts.remove(poiId, id);
  }

  @Get(':id/export')
  export(@Param('poiId') poiId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.contacts.export(poiId, id);
  }

  @Post(':id/whatsapp')
  whatsapp(
    @Param('poiId') poiId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.outreach.whatsappInvite(poiId, id, req.userId, { api: returnUrlBase(this.config, req) });
  }
}

/** Writing to members outside the app ("Write to members"). */
@Controller('pois/:poiId/outreach')
@UseGuards(JwtAuthGuard, PoiAdminGuard)
export class OutreachController {
  constructor(
    private readonly outreach: OutreachService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  history(@Param('poiId') poiId: string) {
    return this.outreach.history(poiId);
  }

  @Get('allowance')
  allowance(@Param('poiId') poiId: string) {
    return this.outreach.allowance(poiId);
  }

  @Post('audience')
  audience(@Param('poiId') poiId: string, @Body() dto: OutreachDto) {
    return this.outreach.audienceSize(poiId, dto);
  }

  @Post()
  send(@Param('poiId') poiId: string, @Req() req: AuthenticatedRequest, @Body() dto: OutreachDto) {
    return this.outreach.send(poiId, req.userId, dto, { api: returnUrlBase(this.config, req) });
  }

  @Post('test')
  test(@Param('poiId') poiId: string, @Req() req: AuthenticatedRequest, @Body() dto: OutreachTestDto) {
    return this.outreach.sendTest(poiId, req.userId, dto, { api: returnUrlBase(this.config, req) }, dto.to);
  }
}
