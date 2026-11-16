/**
 * Bizum by number (Seb, 16 Nov 2026). Stripe does not allow Bizum for
 * religious communities and charities, so a member sends the Bizum from
 * their own bank app straight to the community's own Bizum number, with a
 * short concept ("INF 4821") so the team can find it on their statement.
 * The team then marks it received. No provider and no fee: the money
 * never goes near infunion.
 */

// How long an unconfirmed Bizum waits for the team before it is removed.
export const BIZUM_KEEP_DAYS = 7;
// A Bizum started but never marked sent by the member.
export const BIZUM_UNSENT_HOURS = 24;

/**
 * A Spanish mobile number as Bizum takes it: 9 digits starting with 6 or 7,
 * with or without +34 / 0034 and spaces. Returns the 9 digits, or null.
 */
export function normalizeBizumPhone(input: string): string | null {
  let digits = input.replace(/[\s.\-()]/g, '');
  if (digits.startsWith('+34')) digits = digits.slice(3);
  else if (digits.startsWith('0034')) digits = digits.slice(4);
  return /^[67]\d{8}$/.test(digits) ? digits : null;
}

/** "600123456" → "600 123 456", as people read it. */
export function formatBizumPhone(phone: string): string {
  return phone.replace(/^(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3');
}

/** A fresh concept, "INF " and four digits. */
export function newBizumCode(random: () => number = Math.random): string {
  return `INF ${String(1000 + Math.floor(random() * 9000))}`;
}
