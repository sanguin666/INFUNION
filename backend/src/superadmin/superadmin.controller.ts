import {
  Body,
  CallHandler,
  Controller,
  Delete,
  ExecutionContext,
  Get,
  HttpCode,
  Injectable,
  NestInterceptor,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import type { Observable } from 'rxjs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { SuperadminAccountGuard, SuperadminGuard, type SuperadminRequest } from '../auth/guards/superadmin.guard.js';
import type { SuperadminIdentity } from '../auth/superadmin-access.service.js';
import { ModuleType } from '../common/enums/module-type.enum.js';
import { SuperadminAuthService } from './superadmin-auth.service.js';
import { SuperadminService } from './superadmin.service.js';
import {
  ChangePasswordDto,
  ConfirmNameDto,
  CreateCommunityDto,
  SuperadminAdminDto,
  SuperadminCodeDto,
  SuperadminPasswordDto,
  UpdateCommunityDto,
  SuperadminPlanDto,
} from './dto/superadmin.dto.js';
import { RegistrationsService } from '../registrations/registrations.service.js';
import {
  ApproveRegistrationDto,
  DeclineRegistrationDto,
  RegistrationListQuery,
  RegistrationQuestionDto,
} from '../registrations/dto/registration.dto.js';

type AccountRequest = SuperadminRequest & { superadmin: SuperadminIdentity };

/** Nothing the superadmin sees is kept by a browser or a proxy cache. */
@Injectable()
class NoStore implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    context.switchToHttp().getResponse<Response>().setHeader('Cache-Control', 'no-store');
    return next.handle();
  }
}

/**
 * The code step (Seb, 17 Oct 2026): signed in with the password as the
 * superadmin account, set up the authenticator app or give its code.
 */
@Controller('superadmin/auth')
@UseGuards(JwtAuthGuard, SuperadminAccountGuard)
@UseInterceptors(NoStore)
export class SuperadminAuthController {
  constructor(private readonly auth: SuperadminAuthService) {}

  @Get('status')
  status(@Req() request: AccountRequest) {
    return this.auth.status(request.superadmin);
  }

  @Post('enroll')
  @HttpCode(200)
  enroll(@Req() request: AccountRequest, @Body() dto: SuperadminPasswordDto) {
    return this.auth.startEnrollment(request.superadmin, dto.password, request);
  }

  @Post('enroll/confirm')
  @HttpCode(200)
  confirm(@Req() request: AccountRequest, @Body() dto: SuperadminCodeDto) {
    return this.auth.confirmEnrollment(request.superadmin, dto.code, request);
  }

  @Post('verify')
  @HttpCode(200)
  verify(@Req() request: AccountRequest, @Body() dto: SuperadminCodeDto) {
    return this.auth.verify(request.superadmin, dto.code, request);
  }
}

/** Everything else: only with a superadmin token, under an hour old. */
@Controller('superadmin')
@UseGuards(SuperadminGuard)
@UseInterceptors(NoStore)
export class SuperadminController {
  constructor(
    private readonly service: SuperadminService,
    private readonly auth: SuperadminAuthService,
    private readonly registrations: RegistrationsService,
  ) {}

  private actor(request: SuperadminRequest) {
    return { identity: request.superadmin, request };
  }

  // ---- place requests from the landing (Seb, 30 Oct 2026)

  @Get('registrations')
  registrationList(@Query() query: RegistrationListQuery) {
    return this.registrations.list(query.status);
  }

  @Get('registrations/count')
  async registrationCount() {
    return { open: await this.registrations.openCount() };
  }

  @Get('registrations/:id')
  registration(@Param('id', ParseUUIDPipe) id: string) {
    return this.registrations.detail(id);
  }

  @Post('registrations/:id/document/:state')
  @HttpCode(200)
  registrationDocument(
    @Req() request: SuperadminRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('state', new ParseEnumPipe({ checked: 'checked', unchecked: 'unchecked' })) state: 'checked' | 'unchecked',
  ) {
    return this.service.registrationDocumentChecked(this.actor(request), id, state === 'checked');
  }

  @Post('registrations/:id/approve')
  @HttpCode(200)
  approveRegistration(@Req() request: SuperadminRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ApproveRegistrationDto) {
    return this.service.approveRegistration(this.actor(request), id, dto);
  }

  @Post('registrations/:id/question')
  @HttpCode(200)
  questionRegistration(@Req() request: SuperadminRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RegistrationQuestionDto) {
    return this.service.questionRegistration(this.actor(request), id, dto.message);
  }

  @Post('registrations/:id/decline')
  @HttpCode(200)
  declineRegistration(@Req() request: SuperadminRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: DeclineRegistrationDto) {
    return this.service.declineRegistration(this.actor(request), id, dto.reason, !!dto.block);
  }

  @Get('overview')
  overview() {
    return this.service.overview();
  }

  @Get('pois')
  communities() {
    return this.service.listCommunities();
  }

  @Post('pois')
  create(@Req() request: SuperadminRequest, @Body() dto: CreateCommunityDto) {
    return this.service.createCommunity(this.actor(request), dto);
  }

  @Get('pois/:poiId')
  community(@Param('poiId', ParseUUIDPipe) poiId: string) {
    return this.service.community(poiId);
  }

  @Patch('pois/:poiId')
  update(@Req() request: SuperadminRequest, @Param('poiId', ParseUUIDPipe) poiId: string, @Body() dto: UpdateCommunityDto) {
    return this.service.updateCommunity(this.actor(request), poiId, dto);
  }

  @Post('pois/:poiId/suspend')
  @HttpCode(200)
  suspend(@Req() request: SuperadminRequest, @Param('poiId', ParseUUIDPipe) poiId: string) {
    return this.service.setSuspended(this.actor(request), poiId, true);
  }

  @Post('pois/:poiId/unsuspend')
  @HttpCode(200)
  unsuspend(@Req() request: SuperadminRequest, @Param('poiId', ParseUUIDPipe) poiId: string) {
    return this.service.setSuspended(this.actor(request), poiId, false);
  }

  // The community's name, typed again, so a slip of the mouse deletes nothing.
  @Post('pois/:poiId/delete')
  @HttpCode(200)
  async remove(@Req() request: SuperadminRequest, @Param('poiId', ParseUUIDPipe) poiId: string, @Body() dto: ConfirmNameDto) {
    await this.service.deleteCommunity(this.actor(request), poiId, dto.confirmName);
    return { deleted: true };
  }

  @Post('pois/:poiId/modules/:type/:action')
  @HttpCode(200)
  module(
    @Req() request: SuperadminRequest,
    @Param('poiId', ParseUUIDPipe) poiId: string,
    @Param('type', new ParseEnumPipe(ModuleType)) type: ModuleType,
    @Param('action', new ParseEnumPipe({ start: 'start', stop: 'stop', offer: 'offer', unoffer: 'unoffer' }))
    action: 'start' | 'stop' | 'offer' | 'unoffer',
  ) {
    return this.service.moduleAction(this.actor(request), poiId, type, action);
  }

  @Post('pois/:poiId/plan/:action')
  @HttpCode(200)
  plan(
    @Req() request: SuperadminRequest,
    @Param('poiId', ParseUUIDPipe) poiId: string,
    @Param('action', new ParseEnumPipe({ offer: 'offer', unoffer: 'unoffer', extend: 'extend-trial' }))
    action: 'offer' | 'unoffer' | 'extend-trial',
    @Body() dto: SuperadminPlanDto,
  ) {
    return this.service.planAction(this.actor(request), poiId, action, dto.tier);
  }

  @Post('pois/:poiId/admins')
  addAdmin(@Req() request: SuperadminRequest, @Param('poiId', ParseUUIDPipe) poiId: string, @Body() dto: SuperadminAdminDto) {
    return this.service.addAdmin(this.actor(request), poiId, dto.email, dto.firstName);
  }

  @Get('admins/lookup')
  adminLookup(@Query('email') email?: string) {
    return this.service.adminLookup(typeof email === 'string' ? email.slice(0, 200) : '');
  }

  @Post('users/:userId/places/:poiId')
  addPlace(
    @Req() request: SuperadminRequest,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('poiId', ParseUUIDPipe) poiId: string,
  ) {
    return this.service.addPlaceToUser(this.actor(request), userId, poiId);
  }

  @Delete('users/:userId/places/:poiId')
  removePlace(
    @Req() request: SuperadminRequest,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('poiId', ParseUUIDPipe) poiId: string,
  ) {
    return this.service.removePlaceFromUser(this.actor(request), userId, poiId);
  }

  @Delete('pois/:poiId/admins/:userId')
  removeAdmin(
    @Req() request: SuperadminRequest,
    @Param('poiId', ParseUUIDPipe) poiId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.service.removeAdmin(this.actor(request), poiId, userId);
  }

  @Post('pois/:poiId/admins/:userId/reset-password')
  @HttpCode(200)
  resetPassword(
    @Req() request: SuperadminRequest,
    @Param('poiId', ParseUUIDPipe) poiId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.service.resetAdminPassword(this.actor(request), poiId, userId);
  }

  @Get('users')
  users(@Query('q') q?: string) {
    return this.service.searchUsers(typeof q === 'string' ? q.slice(0, 100) : '');
  }

  @Get('users/:userId')
  user(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.service.user(userId);
  }

  @Delete('users/:userId')
  async deleteUser(@Req() request: SuperadminRequest, @Param('userId', ParseUUIDPipe) userId: string) {
    await this.service.deleteUser(this.actor(request), userId);
    return { deleted: true };
  }

  @Get('health')
  health() {
    return this.service.health();
  }

  @Get('audit')
  journal(@Query('before') before?: string, @Query('action') action?: string) {
    return this.service.journal(
      typeof before === 'string' ? before : undefined,
      typeof action === 'string' ? action.slice(0, 60) : undefined,
    );
  }

  @Post('me/password')
  @HttpCode(200)
  async changePassword(@Req() request: SuperadminRequest, @Body() dto: ChangePasswordDto) {
    await this.auth.changePassword(request.superadmin, dto.currentPassword, dto.newPassword, request);
    return { changed: true };
  }
}
