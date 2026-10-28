import { TaxScheme } from '../common/enums/tax-scheme.enum.js';

/**
 * What a gift gives back on a Spanish giver's income tax (IRPF), as the
 * Ley 49/2002 art. 19 reads since the Ley 7/2024 (gifts from 2024 on).
 * Pure, so the app, the admin and the modelo 182 all share one reading.
 * The app shows it as an estimate: the 250 € band counts everything the
 * giver gives in the year, to any entity, and the total deduction is
 * capped at 10 % of their taxable base, neither of which we can know.
 *
 * Mirrored in app/src/utils/taxDeduction.ts: keep the two in step.
 */
export const ES_FIRST_BAND = 250;
export const ES_FIRST_RATE = 80;
export const ES_REST_RATE = 40;
export const ES_RECURRENT_RATE = 45;
export const ES_ART68_RATE = 10;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * What `amount` gives back, when the giver has already given
 * `alreadyGiven` this year (which uses up the 80 % band first).
 */
export function taxSaving(
  scheme: TaxScheme,
  amount: number,
  options: { alreadyGiven?: number; recurrent?: boolean } = {},
): number {
  if (!(amount > 0)) return 0;
  if (scheme === TaxScheme.ES_ART68) return round2((amount * ES_ART68_RATE) / 100);
  if (scheme !== TaxScheme.ES_LEY49) return 0;
  const bandLeft = Math.max(0, ES_FIRST_BAND - Math.max(0, options.alreadyGiven ?? 0));
  const inBand = Math.min(amount, bandLeft);
  const above = amount - inBand;
  const restRate = options.recurrent ? ES_RECURRENT_RATE : ES_REST_RATE;
  return round2((inBand * ES_FIRST_RATE + above * restRate) / 100);
}

/**
 * Whether a giver's gifts count as recurring for the 45 % rate: they gave
 * to the same entity in each of the two years before, each year at least
 * as much as the year before it. `totals` is what they gave in year-1,
 * year-2 and year-3 (0 when nothing). This is the AEAT's own description
 * of the modelo 182's "recurrencia" field; the community's adviser has
 * the last word on an edge case.
 */
export function isRecurrentGiver(totals: { yearMinus1: number; yearMinus2: number; yearMinus3: number }): boolean {
  const { yearMinus1, yearMinus2, yearMinus3 } = totals;
  return yearMinus1 > 0 && yearMinus2 > 0 && yearMinus1 >= yearMinus2 && yearMinus2 >= yearMinus3;
}
