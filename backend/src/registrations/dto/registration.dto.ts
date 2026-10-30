import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { BillingInterval } from '../../common/enums/billing-interval.enum.js';
import { Language } from '../../common/enums/language.enum.js';
import { PlanTier } from '../../common/enums/plan-tier.enum.js';
import { PoiType } from '../../common/enums/poi-type.enum.js';

// The form posts multipart (it carries the document), so every field
// arrives as a string: booleans are "true", empty optional fields "".
const trimmed = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
const optional = () => Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : typeof value === 'string' ? value.trim() : value));
const yes = () => Transform(({ value }) => value === true || value === 'true' || value === 'on');

export class RegistrationCodeDto {
  @trimmed()
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsOptional()
  @IsEnum(Language)
  language?: Language;
}

export class RegistrationVerifyDto {
  @trimmed()
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}

export class CreateRegistrationDto {
  // Proof the email was confirmed: what /registrations/email/verify returned.
  @IsString()
  @IsNotEmpty()
  emailToken!: string;

  // Hidden on the form. A person never fills it; a spam bot does.
  @IsOptional()
  @IsString()
  homepage?: string;

  @IsOptional()
  @optional()
  @IsUUID()
  existingPoiId?: string;

  @trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  placeName!: string;

  @IsEnum(PoiType)
  type!: PoiType;

  @trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  address!: string;

  @trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(12)
  postalCode!: string;

  @trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  city!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/)
  country!: string;

  @IsEnum(Language)
  language!: Language;

  @IsOptional()
  @optional()
  @IsString()
  @MaxLength(200)
  website?: string;

  @trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  legalName!: string;

  @trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  taxId!: string;

  @trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  firstName!: string;

  @trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  lastName!: string;

  @trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  role!: string;

  @IsOptional()
  @optional()
  @IsString()
  @MaxLength(30)
  @Matches(/^[+0-9 ().-]{6,30}$/)
  phone?: string;

  @IsEnum(PlanTier)
  plan!: PlanTier;

  @IsEnum(BillingInterval)
  billingInterval!: BillingInterval;

  @yes()
  @IsBoolean()
  @Equals(true)
  acceptTerms!: boolean;

  @yes()
  @IsBoolean()
  @Equals(true)
  acceptDpa!: boolean;

  @yes()
  @IsBoolean()
  @Equals(true)
  authorised!: boolean;

  // Required for places of worship; checked in the service.
  @IsOptional()
  @yes()
  @IsBoolean()
  acceptReligiousData?: boolean;

  @trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(140)
  signedName!: string;
}

// ---- the superadmin's side

export class ApproveRegistrationDto {
  // The kind of place: only the superadmin sets it, so the request's is a suggestion.
  @IsOptional()
  @IsEnum(PoiType)
  type?: PoiType;

  // Offer the plan instead of starting its free month.
  @IsOptional()
  @IsBoolean()
  offerPlan?: boolean;
}

export class RegistrationQuestionDto {
  @trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message!: string;
}

export class DeclineRegistrationDto {
  @trimmed()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;

  @IsOptional()
  @IsBoolean()
  block?: boolean;
}

export class RegistrationListQuery {
  @IsOptional()
  @IsIn(['open', 'approved', 'declined', 'all'])
  status?: 'open' | 'approved' | 'declined' | 'all';
}
