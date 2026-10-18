import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { PoiType } from '../../common/enums/poi-type.enum.js';
import { Language } from '../../common/enums/language.enum.js';

export class SuperadminCodeDto {
  @Matches(/^\d{6}$/)
  code!: string;
}

export class SuperadminPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password!: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  currentPassword!: string;

  @IsString()
  @Length(12, 200)
  newPassword!: string;
}

export class SuperadminAdminDto {
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;
}

export class UpdateCommunityDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsEnum(PoiType)
  type?: PoiType;

  @IsOptional()
  @IsEnum(Language)
  language?: Language;

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
  @IsBoolean()
  billingComped?: boolean;
}

export class CreateCommunityDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsEnum(PoiType)
  type?: PoiType;

  @IsOptional()
  @IsEnum(Language)
  language?: Language;

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
  @IsBoolean()
  billingComped?: boolean;

  @IsEmail()
  @MaxLength(200)
  adminEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  adminFirstName?: string;
}

export class ConfirmNameDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  confirmName!: string;
}
