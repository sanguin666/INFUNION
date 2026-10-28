import { describe, expect, it } from 'vitest';
import { TaxScheme } from '../common/enums/tax-scheme.enum.js';
import { isRecurrentGiver, taxSaving } from './tax-deduction.js';
import { aeatText, isValidNif, modelo182 } from './modelo182.js';

describe('tax saving on a gift', () => {
  it('gives 80 % on the first 250 € and 40 % above under the Ley 49/2002', () => {
    expect(taxSaving(TaxScheme.ES_LEY49, 50)).toBe(40);
    expect(taxSaving(TaxScheme.ES_LEY49, 250)).toBe(200);
    expect(taxSaving(TaxScheme.ES_LEY49, 300)).toBe(220);
    expect(taxSaving(TaxScheme.ES_LEY49, 300, { recurrent: true })).toBe(222.5);
  });

  it('counts what was already given this year against the 250 € band', () => {
    expect(taxSaving(TaxScheme.ES_LEY49, 100, { alreadyGiven: 200 })).toBe(60);
    expect(taxSaving(TaxScheme.ES_LEY49, 100, { alreadyGiven: 400 })).toBe(40);
  });

  it('gives 10 % outside that regime and nothing for an ordinary association', () => {
    expect(taxSaving(TaxScheme.ES_ART68, 50)).toBe(5);
    expect(taxSaving(TaxScheme.NONE, 50)).toBe(0);
  });

  it('calls a giver recurrent after two years of steady or rising gifts', () => {
    expect(isRecurrentGiver({ yearMinus1: 100, yearMinus2: 100, yearMinus3: 0 })).toBe(true);
    expect(isRecurrentGiver({ yearMinus1: 120, yearMinus2: 100, yearMinus3: 80 })).toBe(true);
    expect(isRecurrentGiver({ yearMinus1: 80, yearMinus2: 100, yearMinus3: 0 })).toBe(false);
    expect(isRecurrentGiver({ yearMinus1: 100, yearMinus2: 0, yearMinus3: 0 })).toBe(false);
  });
});

describe('modelo 182 file', () => {
  const declarant = {
    year: 2026,
    nif: 'G46000000',
    name: 'Asociación Crecer Juntos',
    scheme: TaxScheme.ES_LEY49,
    phone: '961 23 45 67',
    contactName: 'Navarro Elena',
  };

  it('checks DNI and NIE letters', () => {
    expect(isValidNif('12345678Z')).toBe(true);
    expect(isValidNif('12345678A')).toBe(false);
    expect(isValidNif('X1234567L')).toBe(true);
    expect(isValidNif('G46000000')).toBe(true);
  });

  it('writes AEAT text in upper case without accents but keeps the Ñ', () => {
    expect(aeatText('Muñoz Pérez, José')).toBe('MUÑOZ PEREZ, JOSE');
  });

  it('writes 250-character records with the right fields in the right places', () => {
    const result = modelo182(declarant, [
      { name: 'Muñoz Pérez José', taxId: '12345678-Z', postalCode: '46183', total: 120, recurrent: false },
      { name: 'García Ana', taxId: 'X1234567L', postalCode: '28001', total: 600.5, recurrent: true },
      { name: 'Sin NIF', taxId: null, postalCode: '46183', total: 20, recurrent: false },
    ]);
    const [header, first, second] = result.content.split('\r\n');
    expect(result.included).toBe(2);
    expect(result.total).toBe(720.5);
    expect(result.skipped).toEqual([{ name: 'Sin NIF', reason: 'no_tax_id' }]);
    for (const line of [header, first, second]) expect(line).toHaveLength(250);

    // positions in the AEAT layout are 1-based
    const at = (line: string, from: number, to: number) => line.slice(from - 1, to);
    expect(at(header, 1, 8)).toBe('11822026');
    expect(at(header, 9, 17)).toBe('G46000000');
    expect(at(header, 58, 58)).toBe('T');
    expect(at(header, 59, 67)).toBe('961234567');
    expect(at(header, 136, 144)).toBe('000000002');
    expect(at(header, 145, 159)).toBe('000000000072050');
    expect(at(header, 160, 160)).toBe('1');

    expect(at(first, 18, 26)).toBe('12345678Z');
    expect(at(first, 36, 75).trim()).toBe('MUÑOZ PEREZ JOSE');
    expect(at(first, 76, 77)).toBe('46');
    expect(at(first, 78, 78)).toBe('A');
    expect(at(first, 79, 83)).toBe('08000');
    expect(at(first, 84, 96)).toBe('0000000012000');
    expect(at(first, 105, 105)).toBe('F');
    expect(at(first, 132, 132)).toBe('2');

    expect(at(second, 79, 83)).toBe('04500');
    expect(at(second, 132, 132)).toBe('1');
  });

  it('skips a giver whose NIF is wrong or whose postcode gives no province', () => {
    const result = modelo182(declarant, [
      { name: 'Bad', taxId: '12345678A', postalCode: '46183', total: 10, recurrent: false },
      { name: 'Abroad', taxId: '12345678Z', postalCode: 'SW1A', total: 10, recurrent: false },
    ]);
    expect(result.included).toBe(0);
    expect(result.skipped.map((s) => s.reason)).toEqual(['bad_tax_id', 'no_province']);
  });
});
