import { PartialType } from '@nestjs/mapped-types';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EmptyStringToNull } from '../../common/transforms/empty-to-null.js';

export class CampaignAllocationLineDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  label!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  percent!: number;
}

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @EmptyStringToNull()
  description?: string | null;

  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @IsNumber()
  @IsPositive()
  goalAmount?: number | null;

  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @IsDateString()
  @EmptyStringToNull()
  endsAt?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  // Where the money goes; the shares must add up to 100 (checked by the
  // service). null or [] clears it.
  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => CampaignAllocationLineDto)
  allocation?: CampaignAllocationLineDto[] | null;
}

export class UpdateCampaignDto extends PartialType(CreateCampaignDto) {}
