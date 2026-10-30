import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { PhoneAuthService } from './phone-auth.service.js';
import { PhoneVerificationCode } from './entities/phone-verification-code.entity.js';
import { ConsoleSmsSender, SmsSender } from './sms/sms-sender.js';
import { BrevoEmailSender, ConsoleEmailSender, EmailSender } from './email/email-sender.js';
import { AuthGuardsModule } from './auth-guards.module.js';
import { UsersModule } from '../users/users.module.js';
import { UserPoisModule } from '../user-pois/user-pois.module.js';
import { PoisModule } from '../pois/pois.module.js';

@Module({
  imports: [
    UsersModule,
    UserPoisModule,
    // Only for checking that a remembered place still exists. PoisModule
    // depends on AuthGuardsModule rather than on this module, so there is
    // no cycle here.
    PoisModule,
    AuthGuardsModule,
    TypeOrmModule.forFeature([PhoneVerificationCode]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PhoneAuthService,
    // Swap this provider for a Twilio-backed SmsSender to send real codes;
    // nothing else in the login flow needs to change.
    { provide: SmsSender, useClass: ConsoleSmsSender },
    // Real emails once BREVO_API_KEY is set; the log otherwise, with the
    // code shown on screen as for SMS.
    {
      provide: EmailSender,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get<string>('BREVO_API_KEY')
          ? new BrevoEmailSender(config)
          : new ConsoleEmailSender(),
    },
  ],
  // Re-exported so the modules that already import AuthModule for its
  // guards keep working unchanged.
  exports: [AuthGuardsModule, UserPoisModule, PhoneAuthService, EmailSender],
})
export class AuthModule {}
