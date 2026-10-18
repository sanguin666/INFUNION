import { IsBoolean, IsEnum, IsLatitude, IsLongitude, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { PoiType } from '../../common/enums/poi-type.enum.js';

/** What the admin's "Address and map" card saves. null clears the pin. */
export class UpdatePoiLocationDto {
  @IsOptional()
  @IsEnum(PoiType)
  type?: PoiType;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsLatitude()
  latitude?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsLongitude()
  longitude?: number | null;

  @IsOptional()
  @IsBoolean()
  mapVisible?: boolean;
}
