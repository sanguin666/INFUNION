import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { PoisService } from '../pois/pois.service.js';
import { UpdateLanguageDto } from '../common/dto/update-language.dto.js';
import { UpdatePoiProfileDto } from '../common/dto/update-poi-profile.dto.js';
import { UpdateMenuOrderDto } from '../common/dto/update-menu-order.dto.js';
import { UpdateReceiptSettingsDto } from '../common/dto/update-receipt-settings.dto.js';
import { UpdatePoiLocationDto } from '../places-map/dto/update-poi-location.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PoiAdminGuard } from '../auth/guards/poi-admin.guard.js';

// Deliberately its own tiny module rather than living on PoisController:
// PoisModule can't import AuthModule without a circular dependency
// (AuthModule -> UserPoisModule -> PoisModule already), so any
// admin-gated mutation on a POI's own fields lives out here instead.
@Controller('pois/:poiId')
export class PoiSettingsController {
  constructor(private readonly poisService: PoisService) {}

  @Patch('language')
  @UseGuards(JwtAuthGuard, PoiAdminGuard)
  updateLanguage(@Param('poiId') poiId: string, @Body() dto: UpdateLanguageDto) {
    return this.poisService.update(poiId, dto);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard, PoiAdminGuard)
  updateProfile(@Param('poiId') poiId: string, @Body() dto: UpdatePoiProfileDto) {
    return this.poisService.update(poiId, dto);
  }

  // Which modules the app's bottom menu gives a button to, and in what
  // order — the rest fall under More. This is how a POI decides what its
  // people reach in one tap.
  @Patch('menu-order')
  @UseGuards(JwtAuthGuard, PoiAdminGuard)
  updateMenuOrder(@Param('poiId') poiId: string, @Body() dto: UpdateMenuOrderDto) {
    return this.poisService.update(poiId, dto);
  }

  // Who the place's tax receipts are issued by — see Poi.legalName.
  @Patch('receipt-settings')
  @UseGuards(JwtAuthGuard, PoiAdminGuard)
  updateReceiptSettings(@Param('poiId') poiId: string, @Body() dto: UpdateReceiptSettingsDto) {
    return this.poisService.update(poiId, dto);
  }

  // Kind of place, address and pin for the map of communities, and
  // whether to show there at all (Seb, 18 Oct 2026).
  @Patch('location')
  @UseGuards(JwtAuthGuard, PoiAdminGuard)
  updateLocation(@Param('poiId') poiId: string, @Body() dto: UpdatePoiLocationDto) {
    // Only the fields sent: the DTO instance carries the others as
    // undefined, which would blank them in the place handed back.
    const sent = Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined));
    return this.poisService.update(poiId, sent);
  }
}
