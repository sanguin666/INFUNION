import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushToken } from './entities/push-token.entity.js';
import { EventReminder } from './entities/event-reminder.entity.js';
import { DeviceFollow } from './entities/device-follow.entity.js';
import { Event } from '../events/entities/event.entity.js';
import { UserPoi } from '../user-pois/entities/user-poi.entity.js';
import { Poi } from '../pois/entities/poi.entity.js';
import { AuthGuardsModule } from '../auth/auth-guards.module.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationsController } from './notifications.controller.js';
import { DeviceNotificationsController } from './device-notifications.controller.js';
import { ExpoPushClient } from './expo-push.client.js';

@Module({
  imports: [TypeOrmModule.forFeature([PushToken, UserPoi, EventReminder, DeviceFollow, Event, Poi]), AuthGuardsModule],
  controllers: [NotificationsController, DeviceNotificationsController],
  providers: [NotificationsService, ExpoPushClient],
  exports: [NotificationsService],
})
export class NotificationsModule {}
