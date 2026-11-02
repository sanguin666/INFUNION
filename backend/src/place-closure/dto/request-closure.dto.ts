import {
  Equals,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CLOSING_REASONS, type ClosingReason } from '../closure-rules.js';

export class RequestClosureDto {
  // The place's name, typed again.
  @IsString()
  @MaxLength(200)
  confirmName!: string;

  // Asked only of accounts that have one (the office's, email + password).
  @IsOptional()
  @IsString()
  @MaxLength(200)
  password?: string;

  // "I have the authority to close this account for <organisation>."
  @IsBoolean()
  @Equals(true)
  authority!: boolean;

  @IsOptional()
  @IsIn(CLOSING_REASONS)
  reason?: ClosingReason;
}
