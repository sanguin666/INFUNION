import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/guards/jwt-auth.guard.js';
import { PoiAdminGuard } from '../auth/guards/poi-admin.guard.js';
import { PayoutsAccountService } from './payouts-account.service.js';

/** The community's own payment account, from the admin's Contributions page. */
@Controller('pois/:poiId/payouts-account')
@UseGuards(JwtAuthGuard, PoiAdminGuard)
export class PayoutsAccountController {
  constructor(private readonly payouts: PayoutsAccountService) {}

  @Get()
  status(@Param('poiId') poiId: string) {
    return this.payouts.status(poiId);
  }

  @Post('onboarding')
  onboarding(@Param('poiId') poiId: string, @Req() request: AuthenticatedRequest) {
    return this.payouts.startOnboarding(poiId, request.userId);
  }
}
