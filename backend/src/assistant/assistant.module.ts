import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuardsModule } from '../auth/auth-guards.module.js';
import { ActiveModulesModule } from '../active-modules/active-modules.module.js';
import { AssistantUsage } from './assistant-usage.entity.js';
import { AssistantQuestion } from './assistant-question.entity.js';
import { AssistantModel } from './assistant-model.js';
import { AssistantService } from './assistant.service.js';
import { AssistantController } from './assistant.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([AssistantUsage, AssistantQuestion]), AuthGuardsModule, ActiveModulesModule],
  controllers: [AssistantController],
  providers: [AssistantModel, AssistantService],
})
export class AssistantModule {}
