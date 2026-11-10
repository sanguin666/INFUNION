import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';

export class CreatePaymentLinkDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsUUID()
  campaignId?: string | null;

  // null or missing: the payer chooses.
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(10000)
  amount?: number | null;

  @IsOptional()
  @IsBoolean()
  askName?: boolean;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(300)
  message?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endsOn?: string | null;
}

export class UpdatePaymentLinkDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsUUID()
  campaignId?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(10000)
  amount?: number | null;

  @IsOptional()
  @IsBoolean()
  askName?: boolean;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(300)
  message?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endsOn?: string | null;
}
