import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HomePageVersion } from './home-version.entity.js';
import { HomeVersionsService } from './home-versions.service.js';
import { HomeVersionsController } from './home-versions.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([HomePageVersion]), AuthModule],
  controllers: [HomeVersionsController],
  providers: [HomeVersionsService],
})
export class HomeVersionsModule {}
