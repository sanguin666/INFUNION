import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AuthGuardsModule } from '../auth/auth-guards.module.js';
import { DonationsModule } from '../donations/donations.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import {
  PlaceClosureController,
  PlaceExportController,
} from './place-closure.controller.js';
import { PlaceClosureService } from './place-closure.service.js';

@Module({
  imports: [AuthModule, AuthGuardsModule, DonationsModule, NotificationsModule],
  controllers: [PlaceClosureController, PlaceExportController],
  providers: [PlaceClosureService],
  exports: [PlaceClosureService],
})
export class PlaceClosureModule {}
