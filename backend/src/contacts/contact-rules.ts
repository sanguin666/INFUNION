/**
 * Members imported from a community's own list (Seb, 9 Nov 2026): the
 * rules that turn a spreadsheet row into a contact, kept free of Nest and
 * TypeORM so they can be tested on their own.
 */

export type ContactInput = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  telegram?: string | null;
  language?: string | null;
  groups?: string[] | string | null;
};

export type CleanContact = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  telegram: string | null;
  language: string | null;
  groups: string[];
};

export type RowProblem = 'unreachable' | 'badEmail' | 'badPhone';

const LANGUAGES = ['en', 'es', 'fr', 'va', 'ca', 'gl', 'pt'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function text(value: unknown, max: number): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).replace(/\s+/g, ' ').trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/** Emails reach the same person whatever their case or stray spaces. */
export function cleanEmail(raw: unknown): string | null {
  const value = text(raw, 200)?.toLowerCase().replace(/^mailto:/, '') ?? null;
  return value;
}

export function isEmail(value: string): boolean {
  return EMAIL.test(value);
}

/**
 * A phone as the app stores one: "+" and digits. Spanish numbers typed
 * without their country code (9 digits starting 6, 7, 8 or 9) get +34,
 * since that is how almost every list here is written; "0034" becomes
 * "+34". Anything else keeps its digits as they are.
 */
export function cleanPhone(raw: unknown): string | null {
  const value = text(raw, 40);
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (!digits) return null;
  if (value.trim().startsWith('+')) return `+${digits}`;
  if (digits.startsWith('00')) return `+${digits.slice(2)}`;
  if (digits.length === 9 && /^[6-9]/.test(digits)) return `+34${digits}`;
  return digits;
}

/** Enough digits to be a phone someone can be reached on. */
export function isPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 15;
}

/**
 * How two writings of one phone are recognised as the same: its last nine
 * digits, which is a whole national number in Spain, France and Portugal
 * and ignores whether a country code was typed. The app's sign-in stores
 * phones as typed, so this is also what links a member who installs it.
 */
export function phoneKey(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : null;
}

export function cleanTelegram(raw: unknown): string | null {
  const value = text(raw, 64);
  if (!value) return null;
  const handle = value.replace(/^https?:\/\/t\.me\//i, '').replace(/^@/, '').trim();
  return handle ? `@${handle}` : null;
}

export function cleanLanguage(raw: unknown): string | null {
  const value = text(raw, 20)?.toLowerCase() ?? null;
  if (!value) return null;
  const known: Record<string, string> = {
    english: 'en', inglés: 'en', anglais: 'en',
    español: 'es', espanol: 'es', castellano: 'es', spanish: 'es', espagnol: 'es',
    français: 'fr', francais: 'fr', french: 'fr', francés: 'fr', frances: 'fr',
    valencià: 'va', valencia: 'va', valenciano: 'va',
    català: 'ca', catala: 'ca', catalán: 'ca', catalan: 'ca',
    galego: 'gl', gallego: 'gl',
    português: 'pt', portugues: 'pt', portugués: 'pt',
  };
  const code = known[value] ?? value.slice(0, 2);
  return LANGUAGES.includes(code) ? code : null;
}

export function cleanGroups(raw: unknown): string[] {
  const values = Array.isArray(raw) ? raw : raw === null || raw === undefined ? [] : String(raw).split(/[,;|/]/);
  const seen = new Set<string>();
  const groups: string[] = [];
  for (const value of values) {
    const group = text(value, 40);
    if (!group) continue;
    const key = group.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    groups.push(group);
    if (groups.length >= 10) break;
  }
  return groups;
}

/** One row, cleaned, with what is wrong with it if anything. */
export function cleanRow(row: ContactInput): { contact: CleanContact; problem: RowProblem | null } {
  const email = cleanEmail(row.email);
  const phone = cleanPhone(row.phone);
  const whatsappRaw = cleanPhone(row.whatsapp);
  const contact: CleanContact = {
    firstName: text(row.firstName, 80),
    lastName: text(row.lastName, 120),
    email: email && isEmail(email) ? email : null,
    phone: phone && isPhone(phone) ? phone : null,
    whatsapp: whatsappRaw && isPhone(whatsappRaw) ? whatsappRaw : null,
    telegram: cleanTelegram(row.telegram),
    language: cleanLanguage(row.language),
    groups: cleanGroups(row.groups),
  };
  // A name split into one column only: keep it whole as the first name.
  if (!contact.firstName && contact.lastName) {
    contact.firstName = contact.lastName;
    contact.lastName = null;
  }
  const reachable = !!(contact.email || contact.phone || contact.whatsapp || contact.telegram);
  let problem: RowProblem | null = null;
  if (!reachable) {
    problem = email ? 'badEmail' : phone ? 'badPhone' : 'unreachable';
  }
  return { contact, problem };
}

/** The keys a contact is recognised by: its email and its phone. */
export function keysOf(contact: Pick<CleanContact, 'email' | 'phone' | 'whatsapp'>): string[] {
  const keys: string[] = [];
  if (contact.email) keys.push(`e:${contact.email}`);
  const phone = phoneKey(contact.phone) ?? phoneKey(contact.whatsapp);
  if (phone) keys.push(`p:${phone}`);
  return keys;
}

/**
 * Two rows for one person merge: the first value of each field wins, the
 * second fills what the first left empty, groups add up.
 */
export function mergeContacts(into: CleanContact, from: CleanContact): CleanContact {
  return {
    firstName: into.firstName ?? from.firstName,
    lastName: into.lastName ?? from.lastName,
    email: into.email ?? from.email,
    phone: into.phone ?? from.phone,
    whatsapp: into.whatsapp ?? from.whatsapp,
    telegram: into.telegram ?? from.telegram,
    language: into.language ?? from.language,
    groups: cleanGroups([...into.groups, ...from.groups]),
  };
}

export type FilePlan = {
  // One entry per person in the file, rows for the same person merged.
  people: { contact: CleanContact; rows: number[] }[];
  // Rows that can't be reached, by row number (1 = first data row).
  problems: { row: number; problem: RowProblem; name: string | null }[];
};

/** Cleans a whole file and merges the rows that are the same person. */
export function planFile(rows: ContactInput[]): FilePlan {
  const people: FilePlan['people'] = [];
  const problems: FilePlan['problems'] = [];
  const byKey = new Map<string, number>();
  rows.forEach((row, index) => {
    const { contact, problem } = cleanRow(row);
    const number = index + 1;
    if (problem) {
      const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || null;
      // A completely empty line is not a problem worth listing.
      if (name || problem !== 'unreachable') problems.push({ row: number, problem, name });
      return;
    }
    const keys = keysOf(contact);
    const found = keys.map((key) => byKey.get(key)).find((i) => i !== undefined);
    if (found !== undefined) {
      people[found] = { contact: mergeContacts(people[found].contact, contact), rows: [...people[found].rows, number] };
      for (const key of keysOf(people[found].contact)) byKey.set(key, found);
      return;
    }
    people.push({ contact, rows: [number] });
    for (const key of keys) byKey.set(key, people.length - 1);
  });
  return { people, problems };
}

export function displayName(contact: Pick<CleanContact, 'firstName' | 'lastName' | 'email' | 'phone'>): string {
  return [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.email || contact.phone || '';
}
