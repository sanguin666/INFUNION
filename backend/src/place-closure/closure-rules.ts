/**
 * How long each step of closing a place's account lasts (Seb, 2 Nov 2026).
 * One file, so the durations are easy to change once the Spanish lawyer
 * has read them (issue #27).
 */

/** From asking to the erasure: the time to export, or to change one's mind. */
export const GRACE_DAYS = 30;

/** Reminders to the admins, in days before the closing date. */
export const REMINDER_DAYS_BEFORE = [7, 1];

/**
 * Gifts and tax receipts of a closed place are kept blocked (LOPDGDD art.
 * 32 and 33.3) while the tax office can still check them: four years from
 * the end of the modelo 182 filing for the gift's year (LGT art. 66), with
 * a margin. Then the givers' names, tax IDs and addresses are erased.
 */
export function giftsBlockedUntil(giftYear: number): Date {
  return new Date(Date.UTC(giftYear + 5, 6, 1));
}

/**
 * The newest gift year whose givers can be erased at `now`: every gift of
 * that year or before has passed giftsBlockedUntil.
 */
export function lastAnonymisableGiftYear(now: Date): number {
  let year = now.getUTCFullYear();
  while (giftsBlockedUntil(year) > now) year -= 1;
  return year;
}

/**
 * infunion's own invoices to the place, the signed agreement and the
 * closed place itself: six years (Código de Comercio art. 30), then all
 * of it goes.
 */
export const RECORD_YEARS = 6;

export function closesAtFrom(requestedAt: Date): Date {
  return new Date(requestedAt.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000);
}

export function recordsEndAt(closedAt: Date): Date {
  const end = new Date(closedAt);
  end.setUTCFullYear(end.getUTCFullYear() + RECORD_YEARS);
  return end;
}

/** Why a place leaves, as the admin picks it (optional). */
export const CLOSING_REASONS = [
  'not_used',
  'too_expensive',
  'other_tool',
  'place_closed',
  'merged',
  'other',
] as const;
export type ClosingReason = (typeof CLOSING_REASONS)[number];
