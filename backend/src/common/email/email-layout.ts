import { Language } from '../enums/language.enum.js';

/**
 * The one look every infunion email shares (Seb, 2 Nov 2026): a white card
 * on the lavender-grey page, the coloured infunion logo on a light header,
 * a thin yellow line under it, the content, then a small footer with the
 * website and the support address. Every email, today's and future ones,
 * goes through `emailLayout` so they all stay the same.
 *
 * Inline styles and tables only: that is what mail apps (Gmail, Outlook)
 * reliably render. The logo is a PNG on the landing site because Gmail does
 * not show SVG; when images are blocked its alt text "infunion" shows.
 */

export const EMAIL_LOGO_URL =
  'https://www.infunion.app/assets/email/infunion-logo.png?v=20261103';
export const EMAIL_SITE_URL = 'https://www.infunion.app';
export const EMAIL_SUPPORT = 'support@infunion.app';

export const EMAIL_COLORS = {
  page: '#F6F5F9',
  ink: '#1D1A2D',
  muted: '#5B5870',
  faint: '#8A86A0',
  purple: '#6C4FD9',
  purpleDeep: '#5638C7',
  lavender: '#ECE8FC',
  yellow: '#F9B800',
  border: '#E4E0F2',
  rule: '#EEEBF6',
} as const;

// The slogan from Seb's logo kit (3 Nov 2026), in the reader's language.
const TAGLINE: Record<Language, string> = {
  [Language.EN]: 'The union that makes you a community',
  [Language.ES]: 'La unión que te hace comunidad',
  [Language.FR]: 'L’union qui fait de vous une communauté',
  [Language.VA]: 'La unió que et fa comunitat',
  [Language.CA]: 'La unió que et fa comunitat',
  [Language.GL]: 'A unión que te fai comunidade',
  [Language.PT]: 'A união que te faz comunidade',
};

const FONT = 'Arial,Helvetica,sans-serif';

export function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ] ?? c,
  );
}

/** A heading at the top of the content. */
export function emailHeading(text: string): string {
  return `<p style="margin:0 0 14px;font-size:22px;line-height:1.3;font-weight:bold;color:${EMAIL_COLORS.ink}">${escapeHtml(text)}</p>`;
}

/** A paragraph of plain text (escaped; line breaks kept). */
export function emailParagraph(
  text: string,
  options: { muted?: boolean; small?: boolean } = {},
): string {
  const color = options.muted ? EMAIL_COLORS.muted : EMAIL_COLORS.ink;
  const size = options.small ? 14 : 16;
  return `<p style="margin:0 0 16px;font-size:${size}px;line-height:1.6;color:${color}">${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;
}

export type EmailLink = { label: string; url: string };

/** An inline link in the brand purple. */
export function emailLink(link: EmailLink): string {
  return `<a href="${escapeHtml(link.url)}" style="color:${EMAIL_COLORS.purple};text-decoration:underline">${escapeHtml(link.label)}</a>`;
}

/**
 * A paragraph whose `{{key}}` fields are filled: `fields` as escaped text,
 * `links` as inline links. Returns the HTML and the plain-text version.
 */
export function emailRichParagraph(
  template: string,
  fields: Record<string, string>,
  links: Record<string, EmailLink> = {},
  options: { muted?: boolean; small?: boolean } = {},
): { html: string; text: string } {
  const color = options.muted ? EMAIL_COLORS.muted : EMAIL_COLORS.ink;
  const size = options.small ? 14 : 16;
  const parts = template.split(/(\{\{\w+\}\})/);
  let html = '';
  let text = '';
  for (const part of parts) {
    const key = /^\{\{(\w+)\}\}$/.exec(part)?.[1];
    if (key && links[key]) {
      html += emailLink(links[key]);
      text += links[key].label;
    } else if (key && fields[key] !== undefined) {
      html += escapeHtml(fields[key]);
      text += fields[key];
    } else {
      html += escapeHtml(part);
      text += part;
    }
  }
  return {
    html: `<p style="margin:0 0 16px;font-size:${size}px;line-height:1.6;color:${color}">${html.replace(/\n/g, '<br>')}</p>`,
    text,
  };
}

/** Someone's own words (a question, a reason) in a lavender box with a purple edge. */
export function emailQuote(text: string): string {
  return `<div style="margin:0 0 18px;background:${EMAIL_COLORS.lavender};border-left:4px solid ${EMAIL_COLORS.purple};border-radius:8px;padding:14px 16px;font-size:16px;line-height:1.6;color:${EMAIL_COLORS.ink}">${escapeHtml(text).replace(/\n/g, '<br>')}</div>`;
}

/** Label / value rows (sign-in details, request summary) in a lavender box, one per line. */
export function emailDetails(rows: { label: string; value: string }[]): string {
  const cells = rows
    .map(
      (r) =>
        `<tr><td style="padding:4px 0;font-size:13px;color:${EMAIL_COLORS.muted};white-space:nowrap;vertical-align:top;padding-right:14px">${escapeHtml(r.label)}</td><td style="padding:4px 0;font-size:16px;font-weight:bold;color:${EMAIL_COLORS.ink};word-break:break-all">${escapeHtml(r.value)}</td></tr>`,
    )
    .join('');
  return `<div style="margin:0 0 18px;background:${EMAIL_COLORS.lavender};border-radius:12px;padding:12px 16px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-family:${FONT}">${cells}</table></div>`;
}

const LOCALES: Record<Language, string> = {
  [Language.EN]: 'en-GB',
  [Language.ES]: 'es-ES',
  [Language.FR]: 'fr-FR',
  [Language.VA]: 'ca-ES',
  [Language.CA]: 'ca-ES',
  [Language.GL]: 'gl-ES',
  [Language.PT]: 'pt-PT',
};

/** "4 November 2026" in the email's language, from a YYYY-MM-DD date. */
export function emailDate(
  isoDate: string,
  language?: Language | string,
): string {
  const date = new Date(`${isoDate.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  const locale = LOCALES[language as Language] ?? LOCALES[Language.EN];
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** A big code (sign-in code) in a lavender box, kept as one block so it copies cleanly. */
export function emailCode(code: string): string {
  return `<div style="margin:6px 0 22px;background:${EMAIL_COLORS.lavender};border-radius:12px;padding:18px;text-align:center;font-family:${FONT};font-size:36px;line-height:1.2;letter-spacing:10px;font-weight:bold;color:${EMAIL_COLORS.purpleDeep}">${escapeHtml(code)}</div>`;
}

/** The filled purple call-to-action button. */
export function emailButton(label: string, url: string): string {
  return `<p style="margin:8px 0 20px"><a href="${escapeHtml(url)}" style="display:inline-block;background:${EMAIL_COLORS.purple};color:#ffffff;padding:12px 22px;border-radius:12px;font-family:${FONT};font-size:16px;font-weight:bold;text-decoration:none">${escapeHtml(label)}</a></p>`;
}

/** Wraps content blocks (built with the helpers above) in the shared frame. */
export function emailLayout(
  content: string,
  language?: Language | string,
): string {
  const tagline = TAGLINE[language as Language] ?? TAGLINE[Language.EN];
  const c = EMAIL_COLORS;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:${c.page}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${c.page}"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#ffffff;border:1px solid ${c.border};border-radius:16px;font-family:${FONT};color:${c.ink}">
<tr><td style="padding:24px 28px 20px"><a href="${EMAIL_SITE_URL}" style="text-decoration:none"><img src="${EMAIL_LOGO_URL}" width="174" height="30" alt="infunion" style="display:block;border:0;font-family:${FONT};font-size:22px;font-weight:bold;color:${c.purple}"></a></td></tr>
<tr><td style="padding:0 28px"><div style="height:4px;line-height:4px;font-size:0;background:${c.yellow};border-radius:2px">&nbsp;</div></td></tr>
<tr><td style="padding:30px 28px 10px">${content}</td></tr>
<tr><td style="border-top:1px solid ${c.rule};padding:16px 28px;font-size:12px;line-height:1.6;color:${c.faint}">infunion · ${escapeHtml(tagline)}<br><a href="${EMAIL_SITE_URL}" style="color:${c.purple};text-decoration:none">infunion.app</a> · <a href="mailto:${EMAIL_SUPPORT}" style="color:${c.faint};text-decoration:none">${EMAIL_SUPPORT}</a></td></tr>
</table>
</td></tr></table>
</body></html>`;
}
