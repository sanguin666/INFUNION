import { Body, Controller, Delete, Get, Headers, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, BadRequestException } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { RegisterPushTokenDto } from './dto/register-push-token.dto.js';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto.js';
import { SetEventReminderDto } from './dto/set-event-reminder.dto.js';

const TOKEN = /^Expo(nent)?PushToken\[[^\]]+\]$/;

function phone(token: string | undefined): string {
  if (!token || token.length > 200 || !TOKEN.test(token)) throw new BadRequestException('A push token is required');
  return token;
}

/**
 * Notifications for a phone used without an account (Seb, 9 Nov 2026):
 * the same choices as `/auth/me`, keyed by the phone's own Expo push
 * token, sent in the `X-Push-Token` header. Only phones with no account
 * are reached here; a signed-in phone uses `/auth/me`.
 */
@Controller('devices')
export class DeviceNotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('push-tokens')
  @HttpCode(204)
  register(@Body() dto: RegisterPushTokenDto) {
    return this.notificationsService.registerDevice(dto);
  }

  @Delete('push-tokens')
  @HttpCode(204)
  remove(@Headers('x-push-token') token?: string) {
    return this.notificationsService.removeDevice(phone(token));
  }

  @Put('pois/:poiId')
  @HttpCode(204)
  follow(@Headers('x-push-token') token: string | undefined, @Param('poiId', ParseUUIDPipe) poiId: string) {
    return this.notificationsService.followFromDevice(phone(token), poiId);
  }

  @Delete('pois/:poiId')
  @HttpCode(204)
  unfollow(@Headers('x-push-token') token: string | undefined, @Param('poiId', ParseUUIDPipe) poiId: string) {
    return this.notificationsService.unfollowFromDevice(phone(token), poiId);
  }

  @Get('pois/:poiId/notifications')
  preferences(@Headers('x-push-token') token: string | undefined, @Param('poiId', ParseUUIDPipe) poiId: string) {
    return this.notificationsService.getDevicePreferences(phone(token), poiId);
  }

  @Patch('pois/:poiId/notifications')
  updatePreferences(
    @Headers('x-push-token') token: string | undefined,
    @Param('poiId', ParseUUIDPipe) poiId: string,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationsService.updateDevicePreferences(phone(token), poiId, dto);
  }

  @Get('pois/:poiId/event-reminders')
  eventReminders(@Headers('x-push-token') token: string | undefined, @Param('poiId', ParseUUIDPipe) poiId: string) {
    return this.notificationsService.listDeviceEventReminders(phone(token), poiId);
  }

  @Put('event-reminders/:eventId')
  @HttpCode(204)
  addEventReminder(
    @Headers('x-push-token') token: string | undefined,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: SetEventReminderDto,
  ) {
    return this.notificationsService.addDeviceEventReminder(phone(token), eventId, dto.onlyDate);
  }

  @Delete('event-reminders/:eventId')
  @HttpCode(204)
  removeEventReminder(
    @Headers('x-push-token') token: string | undefined,
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ) {
    return this.notificationsService.removeDeviceEventReminder(phone(token), eventId);
  }
}
