import { Module } from '@nestjs/common';
import { PublicFilesController } from './public-files.controller.js';

@Module({ controllers: [PublicFilesController] })
export class PublicFilesModule {}
