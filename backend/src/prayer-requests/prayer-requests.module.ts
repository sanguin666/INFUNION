import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrayerRequest } from './entities/prayer-request.entity.js';
import { PrayerRequestsService } from './prayer-requests.service.js';
import { PrayerRequestsController } from './prayer-requests.controller.js';
import { PoisModule } from '../pois/pois.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';
import { ModerationModule } from '../moderation/moderation.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([PrayerRequest]), PoisModule, AuthModule, UsersModule, ModerationModule],
  controllers: [PrayerRequestsController],
  providers: [PrayerRequestsService],
  exports: [PrayerRequestsService],
})
export class PrayerRequestsModule {}
