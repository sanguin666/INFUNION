import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { buildTypeOrmConfig } from './config/typeorm.config.js';
import { UsersModule } from './users/users.module.js';
import { PoisModule } from './pois/pois.module.js';
import { UserPoisModule } from './user-pois/user-pois.module.js';
import { ActiveModulesModule } from './active-modules/active-modules.module.js';
import { AnnouncementsModule } from './announcements/announcements.module.js';
import { EventsModule } from './events/events.module.js';
import { PrayerRequestsModule } from './prayer-requests/prayer-requests.module.js';
import { LivestreamsModule } from './livestreams/livestreams.module.js';
import { CommunityModule } from './community/community.module.js';
import { AuthModule } from './auth/auth.module.js';
import { DonationsModule } from './donations/donations.module.js';
import { PoiSettingsModule } from './poi-settings/poi-settings.module.js';
import { PoiPageModule } from './poi-page/poi-page.module.js';
import { PoiBadgesModule } from './poi-badges/poi-badges.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { ServiceRequestsModule } from './service-requests/service-requests.module.js';
import { MassIntentionsModule } from './mass-intentions/mass-intentions.module.js';
import { PrivateFilesModule } from './private-files/private-files.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { DailyReadingsModule } from './daily-readings/daily-readings.module.js';
import { SuperadminModule } from './superadmin/superadmin.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: buildTypeOrmConfig,
    }),
    UsersModule,
    PoisModule,
    UserPoisModule,
    ActiveModulesModule,
    AnnouncementsModule,
    EventsModule,
    PrayerRequestsModule,
    LivestreamsModule,
    CommunityModule,
    AuthModule,
    DonationsModule,
    PoiSettingsModule,
    PoiPageModule,
    PoiBadgesModule,
    DashboardModule,
    ServiceRequestsModule,
    MassIntentionsModule,
    DailyReadingsModule,
    PrivateFilesModule,
    NotificationsModule,
    SuperadminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
