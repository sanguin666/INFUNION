import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceRequest } from '../service-requests/entities/service-request.entity.js';
import { ServiceRequestMessage } from '../service-requests/entities/service-request-message.entity.js';
import { ServiceRequestDocument } from '../service-requests/entities/service-request-document.entity.js';
import { MassIntention } from '../mass-intentions/entities/mass-intention.entity.js';
import { PoiBadge } from '../poi-badges/entities/poi-badge.entity.js';
import { UserPoi } from '../user-pois/entities/user-poi.entity.js';
import { PrayerRequest } from '../prayer-requests/entities/prayer-request.entity.js';
import { AuthModule } from '../auth/auth.module.js';
import { DashboardService } from './dashboard.service.js';
import { DashboardController, MyAdminPlacesController } from './dashboard.controller.js';
import { ActiveModule } from '../active-modules/entities/active-module.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ServiceRequest,
      ServiceRequestMessage,
      ServiceRequestDocument,
      MassIntention,
      PoiBadge,
      UserPoi,
      PrayerRequest,
      ActiveModule,
    ]),
    AuthModule,
  ],
  controllers: [DashboardController, MyAdminPlacesController],
  providers: [DashboardService],
})
export class DashboardModule {}
