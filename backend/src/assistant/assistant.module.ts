import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuardsModule } from '../auth/auth-guards.module.js';
import { ActiveModulesModule } from '../active-modules/active-modules.module.js';
import { AssistantUsage } from './assistant-usage.entity.js';
import { AssistantQuestion } from './assistant-question.entity.js';
import { AdminAssistantUsage } from './admin-assistant-usage.entity.js';
import { AdminAssistantService } from './admin-assistant.service.js';
import { AssistantModel } from './assistant-model.js';
import { AssistantService } from './assistant.service.js';
import { AdminAssistantController, AssistantController } from './assistant.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([AssistantUsage, AssistantQuestion, AdminAssistantUsage]), AuthGuardsModule, ActiveModulesModule],
  controllers: [AssistantController, AdminAssistantController],
  providers: [AssistantModel, AssistantService, AdminAssistantService],
})
export class AssistantModule {}
