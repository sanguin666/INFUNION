import { Module } from '@nestjs/common';
import { AuthGuardsModule } from '../auth/auth-guards.module.js';
import { PrivacyService } from './privacy.service.js';
import {
  MemberPrivacyController,
  MyPrivacyController,
  PrivacyExportController,
} from './privacy.controller.js';

@Module({
  imports: [AuthGuardsModule],
  controllers: [
    MyPrivacyController,
    PrivacyExportController,
    MemberPrivacyController,
  ],
  providers: [PrivacyService],
})
export class PrivacyModule {}
