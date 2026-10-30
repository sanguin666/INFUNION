import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Language } from '../../common/enums/language.enum.js';
import { PHONE_INPUT_PATTERN } from './request-phone-code.dto.js';

// The app's one sign-in field takes either: a phone number (as loose as
// PHONE_INPUT_PATTERN) or an email address. The service tells them apart
// by the @ (see isEmailLogin) and trims both.
const LOGIN_INPUT_PATTERN = new RegExp(
  `^\\s*(?:${PHONE_INPUT_PATTERN.source.slice(1, -1)}|[^\\s@]+@[^\\s@]+\\.[^\\s@]+)\\s*$`,
);
const LOGIN_MESSAGE = 'Enter an email address or a phone number';

export class RequestLoginCodeDto {
  @IsString()
  @MaxLength(254)
  @Matches(LOGIN_INPUT_PATTERN, { message: LOGIN_MESSAGE })
  login!: string;

  // The language the email is written in; the app sends the one it shows.
  @IsOptional()
  @IsIn(Object.values(Language))
  language?: Language;
}

export class VerifyLoginCodeDto {
  @IsString()
  @MaxLength(254)
  @Matches(LOGIN_INPUT_PATTERN, { message: LOGIN_MESSAGE })
  login!: string;

  @IsString()
  @Matches(/^[0-9]{6}$/, { message: 'The code is 6 digits' })
  code!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;
}
