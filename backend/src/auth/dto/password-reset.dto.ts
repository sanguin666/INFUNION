import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Language } from '../../common/enums/language.enum.js';

export class ForgotPasswordDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  // The language the email is written in: the dashboard sends the one it shows.
  @IsOptional()
  @IsIn(Object.values(Language))
  language?: Language;
}

export class ResetPasswordDto {
  @IsString()
  @MaxLength(2000)
  token!: string;

  // The real minimum (8 for an admin, 12 for the superadmin) is checked
  // in the service once the account is known.
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}
