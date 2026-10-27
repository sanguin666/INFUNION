import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PLATFORMS, type Platform } from '../app-updates.store.js';

export class UpdateAssetDto {
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  hash!: string;

  @IsString()
  @MaxLength(100)
  key!: string;

  @Matches(/^[\w.+-]+\/[\w.+-]+$/)
  contentType!: string;

  @Matches(/^(\.[A-Za-z0-9]{1,10})?$/)
  fileExtension!: string;
}

/** What the publish script sends once every file is on the server. */
export class PublishUpdateDto {
  @IsIn(PLATFORMS)
  platform!: Platform;

  @Matches(/^[A-Za-z0-9._-]{1,100}$/)
  runtimeVersion!: string;

  @ValidateNested()
  @Type(() => UpdateAssetDto)
  launchAsset!: UpdateAssetDto;

  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => UpdateAssetDto)
  assets!: UpdateAssetDto[];

  @IsObject()
  expoClient!: Record<string, unknown>;

  @IsOptional()
  @Matches(/^[0-9a-f]{7,40}$/)
  commit?: string;
}

export class MissingAssetsDto {
  @IsArray()
  @ArrayMaxSize(2000)
  @Matches(/^[A-Za-z0-9_-]{43}$/, { each: true })
  hashes!: string[];
}
