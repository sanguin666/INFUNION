import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PoiAdminGuard } from '../auth/guards/poi-admin.guard.js';
import { HomeVersionsService } from './home-versions.service.js';
import { VersionNameDto } from './dto/version-name.dto.js';

/** Home page versions (#194): the community's admins only. */
@Controller('pois/:poiId/page-versions')
@UseGuards(JwtAuthGuard, PoiAdminGuard)
export class HomeVersionsController {
  constructor(private readonly versions: HomeVersionsService) {}

  @Get()
  list(@Param('poiId', ParseUUIDPipe) poiId: string) {
    return this.versions.list(poiId);
  }

  @Post()
  save(@Param('poiId', ParseUUIDPipe) poiId: string, @Body() dto: VersionNameDto) {
    return this.versions.save(poiId, dto.name);
  }

  @Post(':id/use')
  use(@Param('poiId', ParseUUIDPipe) poiId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.versions.use(poiId, id);
  }

  @Patch(':id')
  rename(@Param('poiId', ParseUUIDPipe) poiId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: VersionNameDto) {
    return this.versions.rename(poiId, id, dto.name);
  }

  @Delete(':id')
  remove(@Param('poiId', ParseUUIDPipe) poiId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.versions.remove(poiId, id);
  }
}
