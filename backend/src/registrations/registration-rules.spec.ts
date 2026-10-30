import { PoiType } from '../common/enums/poi-type.enum.js';
import {
  isDisposableEmail,
  isPlausibleTaxId,
  isValidSpanishTaxId,
  namesLookAlike,
  normalizeTaxId,
  taxIdFitsKind,
} from './registration-rules.js';

describe('registration rules', () => {
  it('normalizes a tax ID typed with spaces, dots and dashes', () => {
    expect(normalizeTaxId(' g-98.765.431 ')).toBe('G98765431');
  });

  it('accepts well-formed Spanish NIFs and refuses a wrong check character', () => {
    expect(isValidSpanishTaxId('12345678Z')).toBe(true); // DNI
    expect(isValidSpanishTaxId('12345678A')).toBe(false);
    expect(isValidSpanishTaxId('X1234567L')).toBe(true); // NIE
    expect(isValidSpanishTaxId('G98765431')).toBe(true); // association, digit control
    expect(isValidSpanishTaxId('G9876543A')).toBe(true); // G takes a digit or a letter
    expect(isValidSpanishTaxId('G98765432')).toBe(false);
    expect(isValidSpanishTaxId('R1234567D')).toBe(true); // religious entity, letter control
    expect(isValidSpanishTaxId('R12345674')).toBe(false); // R never ends in a digit
    expect(isValidSpanishTaxId('B12345674')).toBe(true); // company, digit only
    expect(isValidSpanishTaxId('B1234567D')).toBe(false);
  });

  it('only checks the shape outside Spain', () => {
    expect(isPlausibleTaxId('FR12345678901', 'FR')).toBe(true);
    expect(isPlausibleTaxId('12', 'FR')).toBe(false);
    expect(isPlausibleTaxId('G98765432', 'ES')).toBe(false);
  });

  it('hints when the CIF letter is unusual for the kind of place', () => {
    expect(taxIdFitsKind('G98765431', PoiType.ASSOCIATION)).toBe(true);
    expect(taxIdFitsKind('R1234567D', PoiType.CHURCH)).toBe(true);
    expect(taxIdFitsKind('B12345674', PoiType.CHURCH)).toBe(false);
    expect(taxIdFitsKind('12345678Z', PoiType.ASSOCIATION)).toBe(false); // a person's DNI
  });

  it('refuses throwaway inboxes', () => {
    expect(isDisposableEmail('someone@mailinator.com')).toBe(true);
    expect(isDisposableEmail('lucia@avcampdeturia.es')).toBe(false);
  });

  it('spots names that probably mean the same place', () => {
    expect(namesLookAlike('Nuestra Señora del Carmen', 'Parroquia del Carmen')).toBe(true);
    expect(namesLookAlike('Coral Veus de Bétera', 'Veus de Betera')).toBe(true);
    expect(namesLookAlike('Parroquia San Jaime', 'Parroquia San Roque')).toBe(false);
    expect(namesLookAlike('Parroquia', 'Iglesia')).toBe(false);
  });
});
