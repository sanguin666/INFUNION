import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, MoreThan, Repository } from 'typeorm';
import { randomInt } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { PhoneVerificationCode } from './entities/phone-verification-code.entity.js';
import { SmsSender } from './sms/sms-sender.js';
import { EmailSender } from './email/email-sender.js';
import { codeEmail } from './email/code-email.js';
import { UsersService } from '../users/users.service.js';
import { DEMO_MEMBER_PHONE } from '../common/demo/demo-account.js';

const CODE_LENGTH = 6;
const CODE_TTL_SECONDS = 10 * 60;

// How long before the same number may ask for another code. Long enough to
// stop an accidental double-tap costing an SMS, short enough that someone
// who genuinely didn't get the first one isn't stuck waiting.
const RESEND_INTERVAL_SECONDS = 60;

// Codes one number may ask for in an hour, so a stranger's phone can't be
// made to buzz all evening.
const MAX_CODES_PER_HOUR = 5;

// Wrong guesses one code tolerates. Six digits is a million combinations,
// so five guesses across a ten-minute window is not a realistic attack.
const MAX_ATTEMPTS = 5;

// How long a member's sign-in lasts on their phone.
const MEMBER_SESSION = '90d';

/**
 * Turns whatever someone typed into one canonical form: digits, with a
 * leading `+` kept if they gave one. "+34 600 00 00 00", "+34-600-000-000"
 * and "+34600000000" all become the same string, so they all reach the
 * same account.
 *
 * Deliberately not full E.164 normalization (which needs a country to
 * resolve a local number like "600 000 000"): that's a libphonenumber-sized
 * job and the app has no country picker yet. The consequence to know about
 * is that the same person typing their number with and without the country
 * code creates two accounts.
 */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/[^0-9]/g, '');
  return trimmed.startsWith('+') ? `+${digits}` : digits;
}

/** Emails reach the same account whatever their case or stray spaces. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * What someone typed in the app's one sign-in field: an email address if
 * it has an @, a phone number otherwise.
 */
export function isEmailLogin(login: string): boolean {
  return login.includes('@');
}

// Who a code is for: exactly one of the two, already normalized. Doubles as
// the `where` that finds that person's codes.
type CodeTarget = { phone: string } | { email: string };

export type RequestCodeResult = {
  expiresInSeconds: number;
  // How the code was sent, so the app can say "sent to your email" or
  // "texted to your number".
  channel: 'sms' | 'email';
  // Only ever set when nothing is configured to deliver the code: without it
  // there'd be no way to log in at all on a development machine. See
  // sms/sms-sender.ts and email/email-sender.ts.
  devCode?: string;
};

@Injectable()
export class PhoneAuthService {
  constructor(
    @InjectRepository(PhoneVerificationCode)
    private readonly codesRepository: Repository<PhoneVerificationCode>,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly smsSender: SmsSender,
    private readonly configService: ConfigService,
    private readonly emailSender: EmailSender,
  ) {}

  /** The app's one field: "Email or phone number". */
  requestLoginCode(login: string, language?: string): Promise<RequestCodeResult> {
    return isEmailLogin(login)
      ? this.requestEmailCode(login, language)
      : this.requestCode(login);
  }

  verifyLoginCode(login: string, code: string, firstName?: string): Promise<{ accessToken: string }> {
    return isEmailLogin(login)
      ? this.verifyEmailCode(login, code, firstName)
      : this.verifyCode(login, code, firstName);
  }

  async requestCode(rawPhone: string): Promise<RequestCodeResult> {
    const phone = normalizePhone(rawPhone);
    const code = await this.issueCode({ phone });
    await this.smsSender.send(phone, `${code} is your infunion code.`);
    return {
      expiresInSeconds: CODE_TTL_SECONDS,
      channel: 'sms',
      ...(this.shouldRevealCode(this.smsSender.delivers) ? { devCode: code } : {}),
    };
  }

  async requestEmailCode(rawEmail: string, language?: string): Promise<RequestCodeResult> {
    const email = normalizeEmail(rawEmail);
    const code = await this.issueCode({ email });
    await this.emailSender.send(codeEmail(email, code, language));
    return {
      expiresInSeconds: CODE_TTL_SECONDS,
      channel: 'email',
      ...(this.shouldRevealCode(this.emailSender.delivers) ? { devCode: code } : {}),
    };
  }

  async verifyCode(
    rawPhone: string,
    code: string,
    firstName?: string,
  ): Promise<{ accessToken: string }> {
    const phone = normalizePhone(rawPhone);
    await this.consumeCode({ phone }, code);
    const user = await this.usersService.findOrCreateByPhone(phone, firstName);
    return { accessToken: await this.memberToken(user.id) };
  }

  /**
   * Signing in with an email code. An address that already belongs to an
   * admin opens that same account: whoever reads the inbox could reset
   * the password anyway. The superadmin still needs its own second step
   * (a superadmin token), which no member token ever is.
   */
  async verifyEmailCode(
    rawEmail: string,
    code: string,
    firstName?: string,
  ): Promise<{ accessToken: string }> {
    const email = normalizeEmail(rawEmail);
    await this.consumeCode({ email }, code);
    const user = await this.usersService.findOrCreateByEmail(email, firstName);
    return { accessToken: await this.memberToken(user.id) };
  }

  /**
   * Checks an email code without signing anyone in: the place
   * registration form uses it to prove the applicant owns the address.
   */
  async confirmEmailCode(rawEmail: string, code: string): Promise<string> {
    const email = normalizeEmail(rawEmail);
    await this.consumeCode({ email }, code);
    return email;
  }

  private async issueCode(target: CodeTarget): Promise<string> {
    const now = new Date();

    await this.assertNotThrottled(target, now);

    // Any code still outstanding for this person stops working now: only
    // the newest one should ever be accepted, otherwise asking for a fresh
    // code would widen the window instead of restarting it.
    await this.codesRepository.update(
      { ...target, consumedAt: IsNull() },
      { consumedAt: now },
    );

    const code = String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, '0');
    await this.codesRepository.save(
      this.codesRepository.create({
        ...target,
        codeHash: await bcrypt.hash(code, 10),
        expiresAt: new Date(now.getTime() + CODE_TTL_SECONDS * 1000),
      }),
    );
    return code;
  }

  /** Accepts `code` for `target` exactly once, or throws. */
  private async consumeCode(target: CodeTarget, code: string): Promise<void> {
    const now = new Date();

    const record = await this.codesRepository.findOne({
      where: { ...target, consumedAt: IsNull(), expiresAt: MoreThan(now) },
      order: { createdAt: 'DESC' },
    });
    // One message for "never asked", "already used" and "too old": which of
    // those it is tells an attacker whether a number is in use.
    if (!record) {
      throw new UnauthorizedException('That code has expired. Ask for a new one.');
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      record.consumedAt = now;
      await this.codesRepository.save(record);
      throw new UnauthorizedException('Too many wrong codes. Ask for a new one.');
    }

    if (!(await bcrypt.compare(code, record.codeHash))) {
      record.attempts += 1;
      await this.codesRepository.save(record);
      throw new UnauthorizedException('That code is not right.');
    }

    record.consumedAt = now;
    await this.codesRepository.save(record);
  }

  /**
   * A member stays signed in on their phone for MEMBER_SESSION: being
   * asked for a new code every week is exactly what this audience would
   * give up on. Admin sessions keep the shorter default.
   */
  private memberToken(userId: string): Promise<string> {
    return this.jwtService.signAsync({ sub: userId }, { expiresIn: MEMBER_SESSION });
  }

  /**
   * Housekeeping for rows nobody will ever look at again. Not scheduled —
   * called opportunistically when a number asks for a code, which is often
   * enough to keep the table from growing without adding a cron dependency.
   */
  private async assertNotThrottled(target: CodeTarget, now: Date): Promise<void> {
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    await this.codesRepository.delete({ expiresAt: LessThan(oneHourAgo) });

    const lastCode = await this.codesRepository.findOne({
      where: target,
      order: { createdAt: 'DESC' },
    });
    if (lastCode) {
      const secondsSince = (now.getTime() - lastCode.createdAt.getTime()) / 1000;
      if (secondsSince < RESEND_INTERVAL_SECONDS) {
        throw new HttpException(
          `Wait ${Math.ceil(RESEND_INTERVAL_SECONDS - secondsSince)} seconds before asking for another code.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const recentCount = await this.codesRepository.count({
      where: { ...target, createdAt: MoreThan(oneHourAgo) },
    });
    if (recentCount >= MAX_CODES_PER_HOUR) {
      throw new HttpException(
        'phone' in target
          ? 'Too many codes requested for this number. Try again later.'
          : 'Too many codes requested for this email. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** Whether "sign in" goes straight into the demo account (see DEMO_MEMBER_PHONE). */
  demoLoginEnabled(): boolean {
    return (
      this.configService.get<string>('DEMO_LOGIN') !== 'off' &&
      this.shouldRevealCode(this.smsSender.delivers)
    );
  }

  async demoSignIn(): Promise<{ accessToken: string }> {
    const user = this.demoLoginEnabled() ? await this.usersService.findByPhone(DEMO_MEMBER_PHONE) : null;
    if (!user) throw new NotFoundException('No demo account here');
    return { accessToken: await this.memberToken(user.id) };
  }

  // Never in production, even if someone deploys without configuring a real
  // sender: handing the code back in the response would make the whole
  // login pointless. The one exception is a demo server that asks for it
  // with DEMO_LOGIN=on, where nobody could sign in otherwise.
  private shouldRevealCode(delivers: boolean): boolean {
    return (
      !delivers &&
      (this.configService.get<string>('NODE_ENV', 'development') !== 'production' ||
        this.configService.get<string>('DEMO_LOGIN') === 'on')
    );
  }
}
