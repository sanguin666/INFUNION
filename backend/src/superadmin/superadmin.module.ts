import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuardsModule } from '../auth/auth-guards.module.js';
import { ActiveModulesModule } from '../active-modules/active-modules.module.js';
import { Poi } from '../pois/entities/poi.entity.js';
import { User } from '../users/entities/user.entity.js';
import { UserPoi } from '../user-pois/entities/user-poi.entity.js';
import { ActiveModule } from '../active-modules/entities/active-module.entity.js';
import { BillingInvoice } from '../active-modules/entities/billing-invoice.entity.js';
import { PushToken } from '../notifications/entities/push-token.entity.js';
import { AuditLog } from './entities/audit-log.entity.js';
import { SuperadminAuthController, SuperadminController } from './superadmin.controller.js';
import { SuperadminAuthService } from './superadmin-auth.service.js';
import { SuperadminService } from './superadmin.service.js';
import { SuperadminBootstrap } from './superadmin-bootstrap.service.js';
import { ErrorTracker } from './error-tracker.js';

@Module({
  imports: [
    AuthGuardsModule,
    ActiveModulesModule,
    TypeOrmModule.forFeature([Poi, User, UserPoi, ActiveModule, BillingInvoice, PushToken, AuditLog]),
  ],
  controllers: [SuperadminAuthController, SuperadminController],
  providers: [
    SuperadminAuthService,
    SuperadminService,
    SuperadminBootstrap,
    ErrorTracker,
    // The same instance counts every route's server errors.
    { provide: APP_INTERCEPTOR, useExisting: ErrorTracker },
  ],
})
export class SuperadminModule {}
