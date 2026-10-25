import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemberConversation } from './entities/member-conversation.entity.js';
import { MemberMessage } from './entities/member-message.entity.js';
import { UserPoi } from '../user-pois/entities/user-poi.entity.js';
import { MemberMessagesService } from './member-messages.service.js';
import { MembersController, MyMessagesController } from './member-messages.controller.js';
import { ActiveModulesModule } from '../active-modules/active-modules.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([MemberConversation, MemberMessage, UserPoi]),
    ActiveModulesModule,
    AuthModule,
    NotificationsModule,
  ],
  controllers: [MembersController, MyMessagesController],
  providers: [MemberMessagesService],
  exports: [MemberMessagesService],
})
export class MemberMessagesModule {}
