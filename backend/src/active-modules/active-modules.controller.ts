import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ActiveModulesService } from './active-modules.service.js';
import { ActivateModuleDto } from './dto/activate-module.dto.js';
import { UpdateActiveModuleDto } from './dto/update-active-module.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PoiAdminGuard } from '../auth/guards/poi-admin.guard.js';

@Controller('pois/:poiId/active-modules')
export class ActiveModulesController {
  constructor(private readonly activeModulesService: ActiveModulesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, PoiAdminGuard)
  activate(@Param('poiId') poiId: string, @Body() dto: ActivateModuleDto) {
    return this.activeModulesService.activate(poiId, dto);
  }

  @Get()
  findActiveModulesForPoi(@Param('poiId') poiId: string, @Query('all') all?: string) {
    // ?all=1 (the admin): Contributions too while its payment account
    // isn't set up, so the admin can show it greyed out.
    return this.activeModulesService.findVisibleModulesForPoi(poiId, all === '1');
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PoiAdminGuard)
  update(@Param('id') id: string, @Body() dto: UpdateActiveModuleDto) {
    return this.activeModulesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PoiAdminGuard)
  remove(@Param('id') id: string) {
    return this.activeModulesService.remove(id);
  }
}
