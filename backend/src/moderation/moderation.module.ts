import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentReport } from './entities/content-report.entity.js';
import { HiddenPerson } from './entities/hidden-person.entity.js';
import { PostingBan } from './entities/posting-ban.entity.js';
import { CommunityPost } from '../community/entities/community-post.entity.js';
import { CommunityComment } from '../community/entities/community-comment.entity.js';
import { PrayerRequest } from '../prayer-requests/entities/prayer-request.entity.js';
import { UserPoi } from '../user-pois/entities/user-poi.entity.js';
import { Poi } from '../pois/entities/poi.entity.js';
import { AuthModule } from '../auth/auth.module.js';
import { AuthGuardsModule } from '../auth/auth-guards.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { ModerationService } from './moderation.service.js';
import {
  HiddenPeopleController,
  ModerationController,
} from './moderation.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContentReport,
      HiddenPerson,
      PostingBan,
      CommunityPost,
      CommunityComment,
      PrayerRequest,
      UserPoi,
      Poi,
    ]),
    AuthModule,
    AuthGuardsModule,
    NotificationsModule,
  ],
  controllers: [ModerationController, HiddenPeopleController],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
