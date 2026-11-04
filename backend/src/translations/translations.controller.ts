import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ArrayMaxSize, ArrayMinSize, IsIn, IsString, IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { TranslationsService } from './translations.service.js';
import {
  TRANSLATABLE_KINDS,
  type TranslatableKind,
} from './entities/content-translation.entity.js';

export class TranslateDto {
  @IsIn(TRANSLATABLE_KINDS)
  kind!: TranslatableKind;

  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @IsUUID('all', { each: true })
  ids!: string[];

  @IsString()
  language!: string;
}

export class DetectDto {
  @IsIn(TRANSLATABLE_KINDS)
  kind!: TranslatableKind;

  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  ids!: string[];
}

@Controller('pois/:poiId/translations')
export class TranslationsController {
  constructor(private readonly translations: TranslationsService) {}

  // Which language each text is in: the app shows Translate under the others.
  @Post('languages')
  @UseGuards(JwtAuthGuard)
  detect(@Param('poiId', ParseUUIDPipe) poiId: string, @Body() dto: DetectDto) {
    return this.translations.detect(poiId, dto.kind, dto.ids);
  }

  // Signed in: translating costs money, so not open to anyone.
  @Post()
  @UseGuards(JwtAuthGuard)
  translate(
    @Param('poiId', ParseUUIDPipe) poiId: string,
    @Body() dto: TranslateDto,
  ) {
    return this.translations.translate(poiId, dto.kind, dto.ids, dto.language);
  }
}
