import { describe, expect, it } from 'vitest';
import { codeEmail } from '../../auth/email/code-email.js';
import {
  readyEmail,
  newRequestEmail,
} from '../../registrations/registration-emails.js';
import { Language } from '../enums/language.enum.js';
import {
  EMAIL_LOGO_URL,
  EMAIL_MARK_URL,
  communityLogoUrl,
  emailDate,
  emailLayout,
  emailParagraph,
  emailText,
} from './email-layout.js';

describe('email layout', () => {
  it('frames content with the logo header and the footer', () => {
    const html = emailLayout(emailParagraph('Hello <you>'), Language.ES);
    expect(html).toContain(EMAIL_LOGO_URL);
    expect(html).toContain('alt="infunion"');
    expect(html).toContain('Hello &lt;you&gt;');
    expect(html).toContain('Hecho con');
    expect(html).toContain(EMAIL_MARK_URL);
    expect(html).toContain('support@infunion.app');
  });

  it('ends every email with the same footer, in HTML and in text (10 Nov 2026)', () => {
    const plain = emailLayout(emailParagraph('A'), Language.EN);
    const community = emailLayout(emailParagraph('B'), Language.EN, { name: 'Crecer Juntos' });
    const footer = (html: string) => html.slice(html.indexOf('border-top:1px solid'));
    expect(footer(plain)).toBe(footer(community));
    expect(footer(plain)).toContain('Made with');
    expect(emailText('Hello\n', Language.FR)).toBe(
      'Hello\n\n--\nRéalisé avec infunion · https://www.infunion.app\nsupport@infunion.app\n',
    );
    expect(codeEmail('a@example.com', '123456', 'es').text).toContain('Hecho con infunion');
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

describe('community header (10 Nov 2026)', () => {
  it('shows the community name in the header and infunion only in the footer', () => {
    const html = emailLayout(emailParagraph('Hi'), Language.EN, { name: 'Nuestra Señora del Carmen' });
    expect(html).toContain('Nuestra Señora del Carmen');
    expect(html).not.toContain(EMAIL_LOGO_URL);
    expect(html.match(/infunion/g)?.length).toBeGreaterThan(0);
    expect(html.indexOf('Nuestra Señora')).toBeLessThan(html.indexOf('infunion.app'));
  });

  it('shows the community logo when it has one', () => {
    const logo = communityLogoUrl('/uploads/places/carmen.png', 'https://api.example.org/');
    expect(logo).toBe('https://api.example.org/uploads/places/carmen.png');
    const html = emailLayout(emailParagraph('Hi'), Language.EN, { name: 'Carmen', logoUrl: logo });
    expect(html).toContain('src="https://api.example.org/uploads/places/carmen.png"');
  });

  it('falls back to the name when the logo cannot be given a public address', () => {
    expect(communityLogoUrl('/uploads/places/carmen.png', undefined)).toBeNull();
    expect(communityLogoUrl(null, 'https://api.example.org')).toBeNull();
  });
});
