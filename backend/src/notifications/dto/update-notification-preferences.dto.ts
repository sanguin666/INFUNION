import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  news?: boolean;

  @IsOptional()
  @IsBoolean()
  requests?: boolean;

  @IsOptional()
  @IsBoolean()
  events?: boolean;

  @IsOptional()
  @IsBoolean()
  live?: boolean;

  @IsOptional()
  @IsBoolean()
  readings?: boolean;

  @IsOptional()
  @IsBoolean()
  messages?: boolean;
}
