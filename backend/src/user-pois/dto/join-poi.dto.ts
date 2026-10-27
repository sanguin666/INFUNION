import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * Joins a user to a POI using the token encoded in the QR code
 * scanned from the flyer.
 */
export class JoinPoiDto {
  @IsString()
  @IsNotEmpty()
  qrCodeToken!: string;

  // Sent once the person has agreed, in the app, that following a church
  // records their religious belief. Required for churches only.
  @IsOptional()
  @IsBoolean()
  religiousConsent?: boolean;
}
