import { IsEnum, IsOptional } from 'class-validator';
import { PoiTheme } from '../enums/poi-theme.enum.js';

/** A community's look in the app; the logo goes up on its own route. */
export class UpdatePoiBrandingDto {
  @IsOptional()
  @IsEnum(PoiTheme)
  theme?: PoiTheme;
}
