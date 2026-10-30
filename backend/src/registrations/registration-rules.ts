import { PoiType } from '../common/enums/poi-type.enum.js';

/**
 * The rules a place's registration request is checked against (Seb, 30 Oct
 * 2026): Basic is free, so nothing about a request may be cheap to fake in
 * bulk. Pure functions, so the spec can try them without a database.
 */

// The versions of the documents a place agrees to. Bump one when its text
// changes: every request records the versions it was signed under.
export const PLACE_TERMS_VERSION = '2026-11';
export const PLACE_DPA_VERSION = '2026-11';

// At most this many requests from one address in a day.
export const MAX_REQUESTS_PER_IP_PER_DAY = 3;

// Declined requests, and the documents of decided ones, are deleted after this.
export const REGISTRATION_RETENTION_DAYS = 90;

// A place may withdraw from the contract within this many days of its
// approval, or at any time before it, without giving a reason: Spanish
// consumer law counts non-profits as consumers (TRLGDCU art. 3 and 102).
export const WITHDRAWAL_DAYS = 14;

export enum RegistrationStatus {
  PENDING = 'pending',
  QUESTION = 'question',
  APPROVED = 'approved',
  DECLINED = 'declined',
  WITHDRAWN = 'withdrawn',
}

export const OPEN_STATUSES = [RegistrationStatus.PENDING, RegistrationStatus.QUESTION];

export enum BlockKind {
  EMAIL = 'email',
  TAX_ID = 'tax_id',
}

/** Upper case, no spaces, dots or dashes: "g-98.765.432" and "G98765432" are the same ID. */
export function normalizeTaxId(raw: string): string {
  return raw.toUpperCase().replace(/[\s.\-/]/g, '');
}

const DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';
const CIF_CONTROL_LETTERS = 'JABCDEFGHI';

/**
 * Whether `taxId` (already normalized) is a well-formed Spanish NIF: a CIF
 * for an entity, or a DNI/NIE for a person, with its check character right.
 */
export function isValidSpanishTaxId(taxId: string): boolean {
  if (/^\d{8}[A-Z]$/.test(taxId)) {
    return DNI_LETTERS[Number(taxId.slice(0, 8)) % 23] === taxId[8];
  }
  if (/^[XYZ]\d{7}[A-Z]$/.test(taxId)) {
    const digits = String('XYZ'.indexOf(taxId[0])) + taxId.slice(1, 8);
    return DNI_LETTERS[Number(digits) % 23] === taxId[8];
  }
  const cif = /^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/.exec(taxId);
  if (!cif) return false;
  const [, letter, body, control] = cif;
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const digit = Number(body[i]);
    if (i % 2 === 0) {
      const doubled = digit * 2;
      sum += Math.floor(doubled / 10) + (doubled % 10);
    } else {
      sum += digit;
    }
  }
  const check = (10 - (sum % 10)) % 10;
  // Some kinds of entity always end in a letter, some always in a digit.
  if ('PQRSNW'.includes(letter)) return control === CIF_CONTROL_LETTERS[check];
  if ('ABEH'.includes(letter)) return control === String(check);
  return control === String(check) || control === CIF_CONTROL_LETTERS[check];
}

/** Outside Spain we only check the shape: letters and digits, 5 to 20. */
export function isPlausibleTaxId(taxId: string, country: string): boolean {
  if (country === 'ES') return isValidSpanishTaxId(taxId);
  return /^[A-Z0-9]{5,20}$/.test(taxId);
}

/**
 * Whether a Spanish CIF's first letter is the usual one for this kind of
 * place: G for associations and foundations, R for religious entities.
 * Only a hint for the superadmin, never a refusal.
 */
export function taxIdFitsKind(taxId: string, type: PoiType): boolean {
  const letter = taxId[0];
  if (/^\d/.test(taxId) || 'XYZ'.includes(letter)) return false; // a person, not an entity
  if (type === PoiType.ASSOCIATION || type === PoiType.CULTURE) return 'GFVJ'.includes(letter);
  return 'RG'.includes(letter);
}

// Throwaway inboxes: a place's admin must be reachable for years.
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.info',
  'sharklasers.com',
  '10minutemail.com',
  'tempmail.com',
  'temp-mail.org',
  'tempmailo.com',
  'yopmail.com',
  'yopmail.fr',
  'trashmail.com',
  'getnada.com',
  'maildrop.cc',
  'dispostable.com',
  'throwawaymail.com',
  'fakeinbox.com',
  'mintemail.com',
  'emailondeck.com',
  'mohmal.com',
  'tempail.com',
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  return DISPOSABLE_DOMAINS.has(domain);
}

/** Lower case, accents and punctuation gone, for "is this the same name?". */
export function comparableName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Words every second place has in its name, which say nothing about which one.
const COMMON_WORDS = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'y', 'i', 'en', 'the', 'of', 'and', 'st', 'san', 'santa', 'sant',
  'nuestra', 'senora', 'parroquia', 'iglesia', 'asociacion', 'associacio', 'club', 'centro', 'centre',
  'comunidad', 'community', 'church', 'mezquita', 'sinagoga', 'coral', 'du', 'des', 'le', 'les',
]);

/**
 * Whether two place names probably mean the same place: one's telling
 * words are all in the other's. "Carmen L'Eliana" and "Nuestra Señora del
 * Carmen" match on "carmen"; two places named only "Parroquia" don't.
 */
export function namesLookAlike(a: string, b: string): boolean {
  const words = (name: string) => comparableName(name).split(' ').filter((w) => w.length > 1 && !COMMON_WORDS.has(w));
  const wa = words(a);
  const wb = words(b);
  if (!wa.length || !wb.length) return comparableName(a) === comparableName(b);
  const [shorter, longer] = wa.length <= wb.length ? [wa, new Set(wb)] : [wb, new Set(wa)];
  return shorter.every((w) => longer.has(w));
}
