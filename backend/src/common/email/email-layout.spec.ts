import { describe, expect, it } from 'vitest';
import { codeEmail } from '../../auth/email/code-email.js';
import {
  readyEmail,
  newRequestEmail,
} from '../../registrations/registration-emails.js';
import { Language } from '../enums/language.enum.js';
import {
  EMAIL_LOGO_URL,
  emailDate,
  emailLayout,
  emailParagraph,
} from './email-layout.js';

describe('email layout', () => {
  it('frames content with the logo header and the footer', () => {
    const html = emailLayout(emailParagraph('Hello <you>'), Language.ES);
    expect(html).toContain(EMAIL_LOGO_URL);
    expect(html).toContain('alt="infunion"');
    expect(html).toContain('Hello &lt;you&gt;');
    expect(html).toContain('la app de tu comunidad');
    expect(html).toContain('support@infunion.app');
  });

  it('is used by every email', () => {
    const emails = [
      codeEmail('a@example.com', '123456', 'fr'),
      readyEmail({
        email: 'a@example.com',
        firstName: 'Ana',
        placeName: 'Crecer Juntos',
        language: Language.ES,
        dashboardUrl: 'https://admin.infunion.app',
        temporaryPassword: null,
        withdrawUrl: 'https://www.infunion.app/withdraw.html',
      }),
      newRequestEmail('b@example.com', {
        placeName: 'X',
        city: 'Y',
        plan: 'basic',
        email: 'a@example.com',
        reviewUrl: 'https://admin.infunion.app',
      }),
    ];
    for (const email of emails) expect(email.html).toContain(EMAIL_LOGO_URL);
    expect(emails[0].html).toContain('Votre code de connexion');
    expect(emails[0].html).toContain('123456');
    expect(emails[1].html).toContain('Abrir mi panel');
  });

  it('shows sign-in details on separate lines and dates in words', () => {
    const ready = readyEmail({
      email: 'ana@example.com',
      firstName: 'Ana',
      placeName: 'Crecer Juntos',
      language: Language.EN,
      dashboardUrl: 'https://admin.infunion.app',
      temporaryPassword: 'Kp7-wq3m',
      withdrawUrl: 'https://infunion.app/withdraw.html',
    });
    expect(ready.text).toContain(
      'Email: ana@example.com\nTemporary password: Kp7-wq3m',
    );
    expect(ready.text).toContain('https://infunion.app/withdraw.html');
    expect(emailDate('2026-11-04', Language.ES)).toBe('4 de noviembre de 2026');
    expect(emailDate('2026-11-04', Language.EN)).toBe('4 November 2026');
  });
});
