import { Module } from '@nestjs/common';
import { CommunitySiteService } from './community-site.service.js';
import { CommunitySiteController, CommunitySitePublicController } from './community-site.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [CommunitySitePublicController, CommunitySiteController],
  providers: [CommunitySiteService],
})
export class CommunitySiteModule {}
