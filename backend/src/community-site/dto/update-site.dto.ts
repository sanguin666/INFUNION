import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, Length } from 'class-validator';
import { SITE_PARTS } from '../community-site.service.js';

export class UpdateSiteDto {
  @IsOptional()
  @IsString()
  @Length(3, 40)
  slug?: string;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(SITE_PARTS.length)
  @IsIn(SITE_PARTS, { each: true })
  hidden?: string[];
}
