import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsIn, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/guards/jwt-auth.guard.js';
import { AssistantService } from './assistant.service.js';
import { AdminAssistantService } from './admin-assistant.service.js';
import { PoiAdminGuard } from '../auth/guards/poi-admin.guard.js';
import { TRANSLATION_LANGUAGES } from '../translations/translator.js';

export class AssistantTurnDto {
  @IsIn(['member', 'assistant'])
  role!: 'member' | 'assistant';

  @IsString()
  @MinLength(1)
  @MaxLength(1500)
  text!: string;
}

export class AskAssistantDto {
  // The conversation so far, the member's question last. Only the last
  // few turns: enough to follow up, little to pay for.
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => AssistantTurnDto)
  turns!: AssistantTurnDto[];

  @IsIn(TRANSLATION_LANGUAGES)
  language!: string;
}

@Controller('pois/:poiId/assistant')
@UseGuards(JwtAuthGuard)
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  // Whether to show "Ask a question" on the home page.
  @Get()
  status(@Param('poiId', ParseUUIDPipe) poiId: string, @Req() req: AuthenticatedRequest) {
    return this.assistant.status(poiId, req.userId);
  }

  @Post()
  ask(@Param('poiId', ParseUUIDPipe) poiId: string, @Req() req: AuthenticatedRequest, @Body() dto: AskAssistantDto) {
    const turns = dto.turns.map((turn) => ({ role: turn.role, text: turn.text.slice(0, turn.role === 'member' ? 500 : 1500) }));
    return this.assistant.ask(poiId, req.userId, turns, dto.language);
  }
}

/** The dashboard's assistant, for the community's admins (Seb, 6 Nov 2026). */
@Controller('pois/:poiId/admin-assistant')
@UseGuards(JwtAuthGuard, PoiAdminGuard)
export class AdminAssistantController {
  constructor(private readonly assistant: AdminAssistantService) {}

  @Get()
  status(@Param('poiId', ParseUUIDPipe) poiId: string, @Req() req: AuthenticatedRequest) {
    return this.assistant.status(poiId, req.userId);
  }

  @Post()
  ask(@Param('poiId', ParseUUIDPipe) poiId: string, @Req() req: AuthenticatedRequest, @Body() dto: AskAssistantDto) {
    const turns = dto.turns.map((turn) => ({ role: turn.role, text: turn.text.slice(0, turn.role === 'member' ? 800 : 2000) }));
    return this.assistant.ask(poiId, req.userId, turns, dto.language);
  }
}
