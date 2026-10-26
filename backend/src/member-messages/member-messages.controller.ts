import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/guards/jwt-auth.guard.js';
import { PoiAdminGuard } from '../auth/guards/poi-admin.guard.js';
import { MemberMessagesService } from './member-messages.service.js';
import { SendMemberMessageDto } from './dto/send-member-message.dto.js';

/**
 * The office's Membres page and its conversations, behind the admin
 * guard. Which side wrote a message is decided by the route, as for
 * requests.
 */
@Controller('pois/:poiId/members')
@UseGuards(JwtAuthGuard, PoiAdminGuard)
export class MembersController {
  constructor(private readonly service: MemberMessagesService) {}

  @Get()
  list(@Param('poiId') poiId: string) {
    return this.service.listMembers(poiId);
  }

  @Get(':userId/messages')
  open(@Param('poiId') poiId: string, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.service.openForStaff(poiId, userId);
  }

  @Post(':userId/messages')
  send(
    @Param('poiId') poiId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: SendMemberMessageDto,
  ) {
    return this.service.sendFromStaff(poiId, userId, req.userId, dto.body);
  }
}

/** The member's side, from the app: their own conversation with the place. */
@Controller('pois/:poiId/messages/mine')
@UseGuards(JwtAuthGuard)
export class MyMessagesController {
  constructor(private readonly service: MemberMessagesService) {}

  @Get()
  open(@Param('poiId') poiId: string, @Req() req: AuthenticatedRequest) {
    return this.service.openMine(poiId, req.userId);
  }

  @Get('unread')
  unread(@Param('poiId') poiId: string, @Req() req: AuthenticatedRequest) {
    return this.service.unreadForMember(poiId, req.userId);
  }

  @Post()
  send(@Param('poiId') poiId: string, @Req() req: AuthenticatedRequest, @Body() dto: SendMemberMessageDto) {
    return this.service.sendMine(poiId, req.userId, dto.body);
  }
}
