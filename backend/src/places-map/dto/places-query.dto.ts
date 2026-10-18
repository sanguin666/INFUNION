import { Transform, Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsLatitude, IsLongitude, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { PoiType } from '../../common/enums/poi-type.enum.js';

export class PlacesQueryDto {
  // Where the person is (or the town they typed). Both or neither: with
  // them the list comes nearest first, with a distance on each place.
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;

  // Only places within this many kilometres. Ignored without lat/lng.
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(20000)
  radiusKm?: number;

  // Comma-separated kinds to keep, e.g. `church,mosque`. Empty: all kinds.
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value))
  @IsArray()
  @IsEnum(PoiType, { each: true })
  types?: PoiType[];

  // Part of a place's name, e.g. `carmen`: every word must appear, accents
  // and case aside. With it, places not yet pinned on the map are found too.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

export class GeocodeQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  q!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  language?: string;
}
