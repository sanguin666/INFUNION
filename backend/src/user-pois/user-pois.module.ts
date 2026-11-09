import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserPoi } from './entities/user-poi.entity.js';
import { UserPoisService } from './user-pois.service.js';
import { UserPoisController } from './user-pois.controller.js';
import { UsersModule } from '../users/users.module.js';
import { PoisModule } from '../pois/pois.module.js';
import { AuthGuardsModule } from '../auth/auth-guards.module.js';
import { ContactLinkModule } from '../contacts/contact-link.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([UserPoi]), UsersModule, PoisModule, AuthGuardsModule, ContactLinkModule],
  controllers: [UserPoisController],
  providers: [UserPoisService],
  exports: [UserPoisService],
})
export class UserPoisModule {}
