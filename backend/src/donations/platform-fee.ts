/**
 * INFUNION's share of each gift (Seb, 18 Oct 2026). The Dons module is free;
 * instead INFUNION keeps a small percentage of every gift made through it.
 * It is stated in the terms only, never advertised: the landing page and
 * the admin say Dons is free.
 *
 * DONATION_FEE_PERCENT overrides the default of 1 (0 turns it off).
 * Nothing is taken yet: gifts land on a single Stripe account, so the fee
 * is only recorded on each gift until payouts to communities exist.
 */
export const DEFAULT_DONATION_FEE_PERCENT = 1;

export function donationFeePercent(): number {
  const raw = process.env.DONATION_FEE_PERCENT;
  if (raw === undefined || raw.trim() === '') return DEFAULT_DONATION_FEE_PERCENT;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : DEFAULT_DONATION_FEE_PERCENT;
}

/** The fee on one gift, rounded to the cent. */
export function donationFee(amount: number, percent = donationFeePercent()): number {
  return Math.round(amount * percent) / 100;
}
