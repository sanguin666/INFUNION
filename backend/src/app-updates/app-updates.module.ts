import { Module } from '@nestjs/common';
import { AppUpdatesController } from './app-updates.controller.js';

@Module({
  controllers: [AppUpdatesController],
})
export class AppUpdatesModule {}
