import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { Poi } from '../pois/entities/poi.entity.js';
import { User } from '../users/entities/user.entity.js';
import { PlaceRegistration } from './entities/place-registration.entity.js';
import { RegistrationBlock } from './entities/registration-block.entity.js';
import { RegistrationsController } from './registrations.controller.js';
import { RegistrationsService } from './registrations.service.js';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([PlaceRegistration, RegistrationBlock, Poi, User])],
  controllers: [RegistrationsController],
  providers: [RegistrationsService],
  exports: [RegistrationsService],
})
export class RegistrationsModule {}
