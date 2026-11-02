import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * How a login code reaches a phone. Every caller goes through this
 * interface; auth.module.ts picks the console sender or Brevo's.
 */
export abstract class SmsSender {
  abstract send(phone: string, message: string): Promise<void>;

  /**
   * Whether codes actually leave the machine. When they don't, the login
   * endpoint hands the code back in its own response so the app can be used
   * without an SMS account — see phone-auth.service.ts.
   */
  abstract readonly delivers: boolean;
}

/**
 * Development sender: writes the code to the backend's log instead of
 * sending it. Paired with the `devCode` field the login endpoint returns,
 * this is what makes the phone login usable on a laptop with no
 * SMS account and no real phone number.
 */
@Injectable()
export class ConsoleSmsSender extends SmsSender {
  readonly delivers = false;

  private readonly logger = new Logger('SMS');

  send(phone: string, message: string): Promise<void> {
    this.logger.log(`(not actually sent) to ${phone}: ${message}`);
    return Promise.resolve();
  }
}

const BREVO_SMS_URL = 'https://api.brevo.com/v3/transactionalSMS/sms';

/**
 * Brevo's transactional SMS (same account and API key as the code emails,
 * prepaid credits). Chosen only when SMS_PROVIDER=brevo as well as
 * BREVO_API_KEY, so that adding the key for emails doesn't switch SMS on
 * before there are credits to send them. The sender shown on the phone is
 * SMS_SENDER (default "infunion": at most 11 letters or digits).
 */
@Injectable()
export class BrevoSmsSender extends SmsSender {
  readonly delivers = true;

  private readonly logger = new Logger('SMS');

  constructor(private readonly config: ConfigService) {
    super();
  }

  async send(phone: string, message: string): Promise<void> {
    let response: Response;
    try {
      response = await fetch(BREVO_SMS_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'api-key': this.config.get<string>('BREVO_API_KEY') ?? '',
        },
        body: JSON.stringify({
          type: 'transactional',
          sender: this.config.get<string>('SMS_SENDER') || 'infunion',
          // Brevo wants the number with its country code and no "+".
          recipient: phone.replace(/\D/g, ''),
          content: message,
          unicodeEnabled: true,
        }),
      });
    } catch (error) {
      this.logger.warn(`Brevo unreachable: ${(error as Error).message}`);
      throw new ServiceUnavailableException('The SMS could not be sent. Please try again.');
    }
    // A code nobody receives leaves the person stuck at the door, so a
    // refusal (no credits, bad number) is the caller's error to show.
    if (!response.ok) {
      this.logger.warn(`Brevo refused an SMS: HTTP ${response.status}`);
      throw new ServiceUnavailableException('The SMS could not be sent. Please try again.');
    }
  }
}
