import { IsBoolean, IsLatitude, IsLongitude, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

/**
 * What the admin's "Address and map" card saves. null clears the pin. Not
 * the kind of place: only the superadmin changes that (Seb, 18 Oct 2026).
 */
export class UpdatePoiLocationDto {
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
