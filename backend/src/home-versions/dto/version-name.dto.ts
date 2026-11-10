import { IsString, Length } from 'class-validator';

export class VersionNameDto {
  @IsString()
  @Length(1, 60)
  name!: string;
}
