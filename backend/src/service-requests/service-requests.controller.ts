import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/guards/jwt-auth.guard.js';
import { PoiAdminGuard } from '../auth/guards/poi-admin.guard.js';
import { documentUploadOptions } from '../common/upload/private-storage.js';
import { REQUEST_FILES_FOLDER, ServiceRequestsService } from './service-requests.service.js';
import {
  CreateServiceRequestDocumentDto,
  CreateServiceRequestDto,
  CreateServiceRequestMessageDto,
  UpdateServiceRequestDocumentDto,
  UpdateServiceRequestDto,
} from './dto/service-request.dto.js';

/**
 * Requests and appointments. Two sets of routes over the same requests:
 * the member's (their own requests only, from the app) and the office's
 * (every request at the place, from the dashboard, behind the admin
 * guard). Which side a message comes from is decided by the route it was
 * posted to, so a staff member testing the app with their own account
 * still reads as a member there.
 */
@Controller('pois/:poiId/requests')
@UseGuards(JwtAuthGuard)
export class ServiceRequestsController {
  constructor(private readonly service: ServiceRequestsService) {}

  // ---- The member's side ----

  @Post()
  create(@Param('poiId') poiId: string, @Req() req: AuthenticatedRequest, @Body() dto: CreateServiceRequestDto) {
    return this.service.create(poiId, req.userId, dto);
  }

  @Get('mine')
  listMine(@Param('poiId') poiId: string, @Req() req: AuthenticatedRequest) {
    return this.service.listMine(poiId, req.userId);
  }

  // Whether the Requests menu button shows its dot: an answer not yet
  // read, or a paper the team asked for and the member has not sent.
  @Get('mine/attention')
  attention(@Param('poiId') poiId: string, @Req() req: AuthenticatedRequest) {
    return this.service.attentionForMember(poiId, req.userId);
  }

  @Get('mine/:id')
  openMine(@Param('poiId') poiId: string, @Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.open(poiId, id, 'member', req.userId);
  }

  @Post('mine/:id/cancel')
  cancel(@Param('poiId') poiId: string, @Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.cancelByMember(poiId, id, req.userId);
  }

  // Multipart: `body` and/or a `file` (a photo or a PDF).
  @Post('mine/:id/messages')
  @UseInterceptors(FileInterceptor('file', documentUploadOptions(REQUEST_FILES_FOLDER)))
  memberMessage(
    @Param('poiId') poiId: string,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateServiceRequestMessageDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.service.addMessage(poiId, id, 'member', req.userId, dto.body, file);
  }

  @Post('mine/:id/documents/:documentId/file')
  @UseInterceptors(FileInterceptor('file', documentUploadOptions(REQUEST_FILES_FOLDER)))
  sendDocument(
    @Param('poiId') poiId: string,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Attach the document');
    return this.service.attachDocumentFile(poiId, id, documentId, req.userId, file);
  }

  // ---- The office's side ----

  @Get()
  @UseGuards(PoiAdminGuard)
  listForStaff(@Param('poiId') poiId: string, @Query('filter') filter?: 'open' | 'closed' | 'all') {
    return this.service.listForStaff(poiId, filter === 'closed' || filter === 'all' ? filter : 'open');
  }

  @Get(':id')
  @UseGuards(PoiAdminGuard)
  openForStaff(@Param('poiId') poiId: string, @Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.open(poiId, id, 'staff', req.userId);
  }

  @Patch(':id')
  @UseGuards(PoiAdminGuard)
  update(@Param('poiId') poiId: string, @Param('id') id: string, @Body() dto: UpdateServiceRequestDto) {
    return this.service.updateByStaff(poiId, id, dto);
  }

  @Post(':id/messages')
  @UseGuards(PoiAdminGuard)
  @UseInterceptors(FileInterceptor('file', documentUploadOptions(REQUEST_FILES_FOLDER)))
  staffMessage(
    @Param('poiId') poiId: string,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateServiceRequestMessageDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.service.addMessage(poiId, id, 'staff', req.userId, dto.body, file);
  }

  @Post(':id/documents')
  @UseGuards(PoiAdminGuard)
  requestDocument(
    @Param('poiId') poiId: string,
    @Param('id') id: string,
    @Body() dto: CreateServiceRequestDocumentDto,
  ) {
    return this.service.requestDocument(poiId, id, dto);
  }

  @Patch(':id/documents/:documentId')
  @UseGuards(PoiAdminGuard)
  updateDocument(
    @Param('poiId') poiId: string,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Body() dto: UpdateServiceRequestDocumentDto,
  ) {
    return this.service.setDocumentReceived(poiId, id, documentId, dto.received);
  }

  @Delete(':id/documents/:documentId')
  @UseGuards(PoiAdminGuard)
  removeDocument(
    @Param('poiId') poiId: string,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
  ) {
    return this.service.removeDocument(poiId, id, documentId);
  }
}
