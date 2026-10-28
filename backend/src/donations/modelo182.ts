import { TaxScheme } from '../common/enums/tax-scheme.enum.js';
import { ES_ART68_RATE, ES_FIRST_BAND, ES_FIRST_RATE, ES_RECURRENT_RATE, ES_REST_RATE } from './tax-deduction.js';

/**
 * The modelo 182 as the file the Agencia Tributaria takes on its Sede
 * ("presentación mediante fichero"): one 250-character type 1 record for
 * the community, then one type 2 record per giver, in ISO-8859-1 with
 * CRLF line ends. Layout from the AEAT's "Diseño de registro modelo 182"
 * (2025 edition). The office still files it itself, with its own
 * certificate, after checking it in the AEAT's validator.
 */

export type Modelo182Declarant = {
  year: number;
  nif: string;
  name: string;
  scheme: TaxScheme;
  // A phone and a person the AEAT can call about the file.
  phone: string | null;
  contactName: string | null;
};

export type Modelo182Giver = {
  name: string;
  taxId: string | null;
  postalCode: string | null;
  total: number;
  recurrent: boolean;
};

export type Modelo182Skip = { name: string; reason: 'no_tax_id' | 'bad_tax_id' | 'no_province' };

const RECORD_LENGTH = 250;

/** Upper case, no accents, only what the AEAT accepts (Ñ and Ç stay). */
export function aeatText(value: string | null | undefined): string {
  return [...(value ?? '').toUpperCase()]
    .map((char) => (char === 'Ñ' || char === 'Ç' ? char : char.normalize('NFD').replace(/[\u0300-\u036f]/g, '')))
    .join('')
    .replace(/[^A-Z0-9 ÑÇ&,.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function alpha(value: string, length: number): string {
  return value.slice(0, length).padEnd(length, ' ');
}

function num(value: number | string, length: number): string {
  return String(value).replace(/\D/g, '').slice(-length).padStart(length, '0');
}

/** Euros as the file wants them: whole cents, no separator, zero padded. */
function money(amount: number, length: number): string {
  return num(Math.round(amount * 100), length);
}

/** A percentage as 3 integer and 2 decimal digits ("08000" is 80 %). */
function percent(value: number): string {
  return num(Math.round(value * 100), 5);
}

const DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';

export function cleanTaxId(value: string | null | undefined): string {
  return (value ?? '').toUpperCase().replace(/[\s.-]/g, '');
}

/**
 * Whether a Spanish NIF looks right: a DNI or NIE with its check letter,
 * or a company / entity NIF in shape (its control digit is not checked).
 */
export function isValidNif(value: string): boolean {
  const nif = cleanTaxId(value);
  const dni = /^(\d{8})([A-Z])$/.exec(nif);
  if (dni) return DNI_LETTERS[Number(dni[1]) % 23] === dni[2];
  const nie = /^([XYZ])(\d{7})([A-Z])$/.exec(nif);
  if (nie) return DNI_LETTERS[Number(`${'XYZ'.indexOf(nie[1])}${nie[2]}`) % 23] === nie[3];
  // K, L and M are for people too (Spaniards under 14, non-residents).
  if (/^[KLM]\d{7}[A-Z]$/.test(nif)) return true;
  return /^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(nif);
}

/** F for a person, J for a company or entity (field 105). */
function giverNature(nif: string): 'F' | 'J' {
  return /^(\d|[XYZKLM])/.test(nif) ? 'F' : 'J';
}

/**
 * The rate for field 79-83. For a person under the Ley 49/2002 the AEAT
 * wants the rate on the part above 250 €, or 80 % when the year's gift is
 * no more than that; a company's rate is not ours to know (its corporate
 * tax decides), so it gets the 40 % general one.
 */
function deductionRate(scheme: TaxScheme, giver: Modelo182Giver, nature: 'F' | 'J'): number {
  if (scheme === TaxScheme.ES_ART68) return ES_ART68_RATE;
  if (nature === 'F' && giver.total <= ES_FIRST_BAND) return ES_FIRST_RATE;
  return giver.recurrent ? ES_RECURRENT_RATE : ES_REST_RATE;
}

/** The type 1 nature (position 160). */
function declarantNature(scheme: TaxScheme): string {
  return scheme === TaxScheme.ES_ART68 ? '2' : '1';
}

function provinceOf(postalCode: string | null): string | null {
  const code = (postalCode ?? '').trim();
  if (!/^\d{5}$/.test(code)) return null;
  const province = Number(code.slice(0, 2));
  return province >= 1 && province <= 52 ? code.slice(0, 2) : null;
}

export function modelo182(
  declarant: Modelo182Declarant,
  givers: Modelo182Giver[],
): { content: string; included: number; total: number; skipped: Modelo182Skip[] } {
  const nif = cleanTaxId(declarant.nif);
  const year = num(declarant.year, 4);
  const skipped: Modelo182Skip[] = [];
  const lines: string[] = [];
  let total = 0;

  for (const giver of givers) {
    const taxId = cleanTaxId(giver.taxId);
    if (!taxId) {
      skipped.push({ name: giver.name, reason: 'no_tax_id' });
      continue;
    }
    if (!isValidNif(taxId)) {
      skipped.push({ name: giver.name, reason: 'bad_tax_id' });
      continue;
    }
    const province = provinceOf(giver.postalCode);
    if (!province) {
      skipped.push({ name: giver.name, reason: 'no_province' });
      continue;
    }
    const nature = giverNature(taxId);
    const recurrent = declarant.scheme === TaxScheme.ES_LEY49 ? (giver.recurrent ? '1' : '2') : '0';
    total += Math.round(giver.total * 100);
    lines.push(
      [
        '2',
        '182',
        year,
        alpha(nif.padStart(9, '0'), 9),
        alpha(taxId.padStart(9, '0'), 9),
        alpha('', 9), // legal representative
        alpha(aeatText(giver.name), 40),
        province,
        'A', // gift outside the priority patronage programmes
        percent(deductionRate(declarant.scheme, giver, nature)),
        money(giver.total, 13),
        ' ', // in kind
        '00', // regional deduction
        '00000',
        nature,
        ' ', // revoked
        '0000',
        ' ', // kind of asset
        alpha('', 20),
        recurrent,
        alpha('', 9),
        alpha('', 40),
        alpha('', 69),
      ].join(''),
    );
  }

  const header = [
    '1',
    '182',
    year,
    alpha(nif.padStart(9, '0'), 9),
    alpha(aeatText(declarant.name), 40),
    'T', // sent electronically
    num(declarant.phone ?? '', 9),
    alpha(aeatText(declarant.contactName), 40),
    // The declaration's number starts with 182; the AEAT's form assigns
    // the rest when the file is presented.
    alpha('182', 13).replace(/ /g, '0'),
    ' ', // complementary
    ' ', // substitute
    num(0, 13),
    num(lines.length, 9),
    num(total, 15),
    declarantNature(declarant.scheme),
    alpha('', 77),
    alpha('', 13),
  ].join('');

  for (const record of [header, ...lines]) {
    if (record.length !== RECORD_LENGTH) throw new Error(`modelo 182 record is ${record.length} long`);
  }
  return {
    content: [header, ...lines].join('\r\n') + '\r\n',
    included: lines.length,
    total: total / 100,
    skipped,
  };
}
