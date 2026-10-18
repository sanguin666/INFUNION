import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Poi } from '../pois/entities/poi.entity.js';
import { AuthGuardsModule } from '../auth/auth-guards.module.js';
import { GeocoderService } from './geocoder.service.js';
import { PlacesMapService } from './places-map.service.js';
import { PlacesMapController } from './places-map.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Poi]), AuthGuardsModule],
  controllers: [PlacesMapController],
  providers: [PlacesMapService, GeocoderService],
  exports: [GeocoderService],
})
export class PlacesMapModule {}
