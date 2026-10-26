import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendMemberMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  body!: string;
}
