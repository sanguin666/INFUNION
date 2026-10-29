import { Body, Controller, Delete, Get, Param, ParseEnumPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ModuleBillingService } from './module-billing.service.js';
import { SetBillingIntervalDto, SetPaymentMethodDto } from './dto/billing.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PoiAdminGuard } from '../auth/guards/poi-admin.guard.js';
import { ModuleType } from '../common/enums/module-type.enum.js';
import { PlanTier } from '../common/enums/plan-tier.enum.js';

// The admin's Modules page: the community's plan, what it pays, and
// showing or hiding the modules its plan has.
@Controller('pois/:poiId/billing')
@UseGuards(JwtAuthGuard, PoiAdminGuard)
export class BillingController {
  constructor(private readonly billing: ModuleBillingService) {}

  @Get()
  summary(@Param('poiId') poiId: string) {
    return this.billing.summary(poiId);
  }

  @Post('plan/:tier/trial')
  startTrial(@Param('poiId') poiId: string, @Param('tier', new ParseEnumPipe(PlanTier)) tier: PlanTier) {
    return this.billing.startTrial(poiId, tier);
  }

  @Post('plan/:tier')
  choosePlan(@Param('poiId') poiId: string, @Param('tier', new ParseEnumPipe(PlanTier)) tier: PlanTier) {
    return this.billing.choosePlan(poiId, tier);
  }

  // Show or hide one module of the plan, at no cost. "start"/"stop" are
  // the names older admins call.
  @Post('modules/:type/start')
  show(@Param('poiId') poiId: string, @Param('type', new ParseEnumPipe(ModuleType)) type: ModuleType) {
    return this.billing.show(poiId, type);
  }

  @Post('modules/:type/stop')
  hide(@Param('poiId') poiId: string, @Param('type', new ParseEnumPipe(ModuleType)) type: ModuleType) {
    return this.billing.hide(poiId, type);
  }

  @Put('interval')
  setInterval(@Param('poiId') poiId: string, @Body() dto: SetBillingIntervalDto) {
    return this.billing.setInterval(poiId, dto.interval);
  }

  @Put('payment-method')
  setPaymentMethod(@Param('poiId') poiId: string, @Body() dto: SetPaymentMethodDto) {
    const label = dto.kind === 'sepa' ? `SEPA •••• ${dto.last4}` : `Carte •••• ${dto.last4}`;
    return this.billing.setPaymentMethod(poiId, label);
  }

  @Delete('payment-method')
  removePaymentMethod(@Param('poiId') poiId: string) {
    return this.billing.setPaymentMethod(poiId, null);
  }
}
