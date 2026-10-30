import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service.js';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/guards/jwt-auth.guard.js';
import { PoiAdminGuard } from '../auth/guards/poi-admin.guard.js';

@Controller('pois/:poiId/dashboard')
@UseGuards(JwtAuthGuard, PoiAdminGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  summary(@Param('poiId') poiId: string) {
    return this.dashboardService.summary(poiId);
  }
}

/** The admin's place switcher: a count beside each place they run. */
@Controller('me/admin-places')
@UseGuards(JwtAuthGuard)
export class MyAdminPlacesController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('waiting')
  waiting(@Req() req: AuthenticatedRequest) {
    return this.dashboardService.waitingByPlace(req.userId);
  }
}
