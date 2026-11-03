import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { EmptyStringToNull } from '../../common/transforms/empty-to-null.js';
import { DonationPurpose } from '../entities/donation.entity.js';

// What the donate screen may choose. A Mass intention's offering is only
// ever started by the Mass intentions module itself.
const CHOOSABLE_PURPOSES = [DonationPurpose.GENERAL, DonationPurpose.COLLECTION, DonationPurpose.CAMPAIGN];

export class CreateDonationDto {
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  donorName?: string;

  @IsOptional()
  @IsIn(CHOOSABLE_PURPOSES)
  purpose?: DonationPurpose;

  @ValidateIf((dto: CreateDonationDto) => dto.purpose === DonationPurpose.CAMPAIGN)
  @IsUUID()
  campaignId?: string;

  // A note to the team, on a gift to where it is most needed only.
  @IsOptional()
  @IsString()
  @MaxLength(300)
  @EmptyStringToNull()
  message?: string | null;

  // Monthly. Needs a signed-in giver, so they can stop it later.
  @IsOptional()
  @IsBoolean()
  recurring?: boolean;

  @IsOptional()
  @IsBoolean()
  wantsReceipt?: boolean;

  // A receipt names the giver and their address, so with one asked for
  // those stop being optional.
  @ValidateIf((dto: CreateDonationDto) => dto.wantsReceipt === true)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  donorAddress?: string;

  @ValidateIf((dto: CreateDonationDto) => dto.wantsReceipt === true)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  donorPostalCode?: string;

  @ValidateIf((dto: CreateDonationDto) => dto.wantsReceipt === true)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  donorCity?: string;

  // The NIF in Spain, where the community reports each giver to the tax
  // office; not asked for in France.
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @EmptyStringToNull()
  donorTaxId?: string | null;
}
