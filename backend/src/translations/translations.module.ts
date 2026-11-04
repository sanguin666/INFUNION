import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentTranslation } from './entities/content-translation.entity.js';
import { ContentLanguage } from './entities/content-language.entity.js';
import { Poi } from '../pois/entities/poi.entity.js';
import { AuthGuardsModule } from '../auth/auth-guards.module.js';
import { Translator } from './translator.js';
import { TranslationsService } from './translations.service.js';
import { TranslationsController } from './translations.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([ContentTranslation, ContentLanguage, Poi]), AuthGuardsModule],
  controllers: [TranslationsController],
  providers: [Translator, TranslationsService],
  exports: [TranslationsService, Translator],
})
export class TranslationsModule {}
