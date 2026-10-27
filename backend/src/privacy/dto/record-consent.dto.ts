import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** The terms version the person just accepted in the app (see CONSENT_VERSION). */
export class RecordConsentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  version!: string;
}
