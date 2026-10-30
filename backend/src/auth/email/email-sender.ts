import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

/**
 * How a sign-in code reaches an inbox. Same shape as SmsSender: the login
 * flow only ever talks to this interface, so which service actually sends
 * is one provider line in auth.module.ts.
 */
export abstract class EmailSender {
  abstract send(message: EmailMessage): Promise<void>;

  /**
   * Whether emails actually leave the machine. When they don't, the login
   * endpoint hands the code back in its own response, as it does for SMS —
   * see phone-auth.service.ts.
   */
  abstract readonly delivers: boolean;
}

/** Development sender: writes the email to the backend's log instead. */
@Injectable()
export class ConsoleEmailSender extends EmailSender {
  readonly delivers = false;

  private readonly logger = new Logger('Email');

  send(message: EmailMessage): Promise<void> {
    this.logger.log(`(not actually sent) to ${message.to}: ${message.subject} — ${message.text}`);
    return Promise.resolve();
  }
}

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

/**
 * Brevo's transactional email API (EU-hosted, free up to 300 emails a
 * day). Chosen when BREVO_API_KEY is set; the sender address is
 * EMAIL_FROM, which must be on a domain verified in Brevo (SPF + DKIM).
 */
@Injectable()
export class BrevoEmailSender extends EmailSender {
  readonly delivers = true;

  private readonly logger = new Logger('Email');

  constructor(private readonly config: ConfigService) {
    super();
  }

  async send(message: EmailMessage): Promise<void> {
    let response: Response;
    try {
      response = await fetch(BREVO_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'api-key': this.config.get<string>('BREVO_API_KEY') ?? '',
        },
        body: JSON.stringify({
          sender: {
            email: this.config.get<string>('EMAIL_FROM') || 'register@infunion.app',
            name: this.config.get<string>('EMAIL_FROM_NAME') || 'infunion',
          },
          to: [{ email: message.to }],
          subject: message.subject,
          textContent: message.text,
          htmlContent: message.html,
        }),
      });
    } catch (error) {
      this.logger.warn(`Brevo unreachable: ${(error as Error).message}`);
      throw new ServiceUnavailableException('The email could not be sent. Please try again.');
    }
    // Unlike a push notification, a code nobody receives leaves the person
    // stuck at the door, so a refusal is the caller's error to show.
    if (!response.ok) {
      this.logger.warn(`Brevo refused an email: HTTP ${response.status}`);
      throw new ServiceUnavailableException('The email could not be sent. Please try again.');
    }
  }
}
