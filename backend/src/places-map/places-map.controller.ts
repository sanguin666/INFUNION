import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { GeocoderService } from './geocoder.service.js';
import { PlacesMapService } from './places-map.service.js';
import { GeocodeQueryDto, PlacesQueryDto } from './dto/places-query.dto.js';

/**
 * The map of communities (Seb, 18 Oct 2026): every place that put itself
 * on the map, nearest first when the app says where the person is. That
 * position is only used for this one query and never stored.
 */
@Controller('map')
export class PlacesMapController {
  constructor(
    private readonly placesMap: PlacesMapService,
    private readonly geocoder: GeocoderService,
  ) {}

  // Open like the directory at GET /pois: nothing here is more than a
  // place already shows on its flyer.
  @Get('places')
  places(@Query() query: PlacesQueryDto) {
    return this.placesMap.findPlaces(query);
  }

  // A town or an address to coordinates: the member's "or a town" field
  // and the admin's address search. Signed-in only, since every call costs
  // a request against Nominatim's one-a-second allowance.
  @Get('geocode')
  @UseGuards(JwtAuthGuard)
  geocode(@Query() query: GeocodeQueryDto) {
    return this.geocoder.search(query.q, query.language);
  }
}
