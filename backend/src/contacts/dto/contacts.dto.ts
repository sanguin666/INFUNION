import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { OutreachKind } from '../entities/outreach.entity.js';

export const MAX_IMPORT_ROWS = 5000;

/**
 * A spreadsheet, as the dashboard read it: one object per row with the
 * columns already matched to our fields. Each row is cleaned on our side
 * (contact-rules.ts), so the values are only checked for shape here.
 */
export class ImportContactsDto {
  @IsArray()
  @ArrayMaxSize(MAX_IMPORT_ROWS)
  rows!: Record<string, unknown>[];

  @IsOptional()
  @IsString()
  @MaxLength(160)
  fileName?: string;

  // "These people are members of our community and gave us their details."
  @IsOptional()
  @IsBoolean()
  confirmed?: boolean;
}

export class ContactDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  lastName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  whatsapp?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  telegram?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  language?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  groups?: string[];
}

export const AUDIENCES = ['notInApp', 'notInvited', 'everyone', 'group', 'contacts'] as const;
export type Audience = (typeof AUDIENCES)[number];

export class OutreachDto {
  @IsIn(Object.values(OutreachKind))
  kind!: OutreachKind;

  @IsIn(AUDIENCES)
  audience!: Audience;

  @ValidateIf((dto: OutreachDto) => dto.audience === 'group')
  @IsString()
  @MaxLength(40)
  group?: string;

  @ValidateIf((dto: OutreachDto) => dto.audience === 'contacts')
  @IsArray()
  @ArrayMaxSize(MAX_IMPORT_ROWS)
  @IsUUID('all', { each: true })
  contactIds?: string[];

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  subject!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;

  @IsOptional()
  @IsUUID()
  campaignId?: string | null;
}

export class OutreachTestDto extends OutreachDto {
  @IsOptional()
  @IsEmail()
  to?: string;
}
