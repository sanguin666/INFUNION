import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { TaxScheme } from '../enums/tax-scheme.enum.js';
import { EmptyStringToNull } from '../transforms/empty-to-null.js';

/** Who issues the place's tax receipts — see Poi.legalName. */
export class UpdateReceiptSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @EmptyStringToNull()
  legalName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @EmptyStringToNull()
  legalTaxId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  @EmptyStringToNull()
  legalAddress?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @EmptyStringToNull()
  receiptSignatory?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @EmptyStringToNull()
  legalPhone?: string | null;

  @IsOptional()
  @IsEnum(TaxScheme)
  taxScheme?: TaxScheme;
}
