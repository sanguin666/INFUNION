import type { TaxScheme } from '../api/types';

/**
 * What a gift gives back on a Spanish giver's income tax, for the gift
 * form's "what it really costs you" line. Mirrors the backend's
 * donations/tax-deduction.ts (Ley 49/2002 art. 19 since the Ley 7/2024):
 * keep the two in step. An estimate: the 250 € band counts the giver's
 * gifts to every entity in the year, and we only know ours.
 */
const FIRST_BAND = 250;
const FIRST_RATE = 80;
const REST_RATE = 40;
const RECURRENT_RATE = 45;
const ART68_RATE = 10;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function taxSaving(
  scheme: TaxScheme | undefined,
  amount: number,
  options: { alreadyGiven?: number; recurrent?: boolean } = {},
): number {
  if (!(amount > 0)) return 0;
  if (scheme === 'es_art68') return round2((amount * ART68_RATE) / 100);
  if (scheme !== 'es_ley49') return 0;
  const bandLeft = Math.max(0, FIRST_BAND - Math.max(0, options.alreadyGiven ?? 0));
  const inBand = Math.min(amount, bandLeft);
  const above = amount - inBand;
  const restRate = options.recurrent ? RECURRENT_RATE : REST_RATE;
  return round2((inBand * FIRST_RATE + above * restRate) / 100);
}
