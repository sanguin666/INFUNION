import { Body, Controller, HttpCode, Post, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { documentUploadOptions } from '../common/upload/private-storage.js';
import { CreateRegistrationDto, RegistrationCodeDto, RegistrationVerifyDto, WithdrawDto } from './dto/registration.dto.js';
import { RegistrationsService } from './registrations.service.js';

/**
 * The landing's "Register your place" form (Seb, 30 Oct 2026). Public:
 * nothing it sends exists anywhere until the superadmin approves it.
 */
@Controller('registrations')
export class RegistrationsController {
  constructor(private readonly registrations: RegistrationsService) {}

  @Post('email/code')
  @HttpCode(200)
  requestCode(@Body() dto: RegistrationCodeDto) {
    return this.registrations.requestEmailCode(dto.email, dto.language);
  }

  @Post('email/verify')
  @HttpCode(200)
  verify(@Body() dto: RegistrationVerifyDto) {
    return this.registrations.verifyEmailCode(dto.email, dto.code);
  }

  // Withdrawal from the contract (14 days): a code to the request's email, then the withdrawal.
  @Post('withdraw/code')
  @HttpCode(200)
  withdrawCode(@Body() dto: RegistrationCodeDto) {
    return this.registrations.requestWithdrawCode(dto.email, dto.language);
  }

  @Post('withdraw')
  @HttpCode(200)
  withdraw(@Body() dto: WithdrawDto) {
    return this.registrations.withdraw(dto.email, dto.code, dto.reason);
  }

  // Multipart: the form's fields plus `document` (a PDF or a photo).
  @Post()
  @UseInterceptors(FileInterceptor('document', documentUploadOptions('registrations')))
  create(@Body() dto: CreateRegistrationDto, @Req() request: Request, @UploadedFile() document?: Express.Multer.File) {
    return this.registrations.create(dto, document, request.ip ?? null, request.get('user-agent') ?? null);
  }
}
