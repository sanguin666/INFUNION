import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActiveModule } from './entities/active-module.entity.js';
import { BillingInvoice } from './entities/billing-invoice.entity.js';
import { PlanTrial } from './entities/plan-trial.entity.js';
import { Poi } from '../pois/entities/poi.entity.js';
import { ModuleBillingService } from './module-billing.service.js';
import { BillingController } from './billing.controller.js';
import { ActiveModulesService } from './active-modules.service.js';
import { ActiveModulesController } from './active-modules.controller.js';
import { PoisModule } from '../pois/pois.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([ActiveModule, BillingInvoice, PlanTrial, Poi]), PoisModule, AuthModule],
  controllers: [ActiveModulesController, BillingController],
  providers: [ActiveModulesService, ModuleBillingService],
  exports: [ActiveModulesService, ModuleBillingService],
})
export class ActiveModulesModule {}
