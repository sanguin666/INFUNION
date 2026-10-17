import { ModuleType } from '../common/enums/module-type.enum.js';
import { ModuleStatus } from '../common/enums/module-status.enum.js';
import { BillingInterval } from '../common/enums/billing-interval.enum.js';

/**
 * ANSAE's module pricing (Seb, 30 Sep 2026): Événements is free, every
 * other module costs 10 € a month or 110 € a year (a month off), and each
 * one can be tried free for a month, once per community.
 *
 * The rules are plain functions over plain objects so they can be tested
 * without a database; ModuleBillingService loads and saves around them.
 */
export const FREE_MODULES: readonly ModuleType[] = [ModuleType.EVENTS];
export const PRICES: Record<BillingInterval, number> = {
  [BillingInterval.MONTHLY]: 10,
  [BillingInterval.YEARLY]: 110,
};

export function isFree(type: ModuleType): boolean {
  return FREE_MODULES.includes(type);
}

/** Same day of the month, n months on; the 31st falls back to month end. */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export function addInterval(date: Date, interval: BillingInterval): Date {
  return addMonths(date, interval === BillingInterval.YEARLY ? 12 : 1);
}

function roundCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export type BillingPoi = {
  billingInterval: BillingInterval;
  billingComped: boolean;
  paymentMethodLabel?: string | null;
  billingRenewsAt?: Date | null;
};

export type BillingModule = {
  moduleType: ModuleType;
  status: ModuleStatus;
  trialEndsAt?: Date | null;
  paidUntil?: Date | null;
  cancelAtPeriodEnd: boolean;
  // Given by ANSAE: never billed, never paused.
  offered?: boolean;
};

export type InvoiceDraft = {
  issuedAt: Date;
  lines: { moduleType: ModuleType; amount: number; periodStart: string; periodEnd: string }[];
};

/**
 * Starts paying for a module at `at`: up to the community's renewal date
 * at that date's share of the price, or, when nothing is paid yet, for a
 * full period that then becomes the renewal date. Mutates both.
 */
export function startPaying(poi: BillingPoi, module: BillingModule, at: Date): InvoiceDraft['lines'][number] {
  const price = PRICES[poi.billingInterval];
  let amount = price;
  if (!poi.billingRenewsAt || poi.billingRenewsAt <= at) {
    poi.billingRenewsAt = addInterval(at, poi.billingInterval);
  } else {
    // The period this renewal date closes, measured backwards from it.
    const back = addMonths(poi.billingRenewsAt, poi.billingInterval === BillingInterval.YEARLY ? -12 : -1);
    const whole = poi.billingRenewsAt.getTime() - back.getTime();
    const left = poi.billingRenewsAt.getTime() - at.getTime();
    amount = roundCents((price * left) / whole);
  }
  module.status = ModuleStatus.ACTIVE;
  module.paidUntil = poi.billingRenewsAt;
  module.cancelAtPeriodEnd = false;
  return {
    moduleType: module.moduleType,
    amount,
    periodStart: at.toISOString(),
    periodEnd: poi.billingRenewsAt.toISOString(),
  };
}

/**
 * Brings a community's modules up to `now`: trials that ended carry on as
 * paid (with a payment method) or pause (without one), and paid modules
 * renew, stop (if the office stopped them), or pause (no payment method)
 * on the renewal date. Each date that charges something makes one invoice.
 * Returns the invoices to record; mutates poi and modules.
 */
export function settle(poi: BillingPoi, modules: BillingModule[], now: Date): InvoiceDraft[] {
  if (poi.billingComped) return [];
  const invoices: InvoiceDraft[] = [];
  // Every pass handles the earliest thing due, so a trial ending before a
  // renewal is billed pro rata to that renewal, as it would have been live.
  for (let guard = 0; guard < 500; guard++) {
    const trial = modules
      .filter((m) => m.status === ModuleStatus.TRIAL && m.trialEndsAt && m.trialEndsAt <= now)
      .sort((a, b) => a.trialEndsAt!.getTime() - b.trialEndsAt!.getTime())[0];
    const renewal = poi.billingRenewsAt && poi.billingRenewsAt <= now ? poi.billingRenewsAt : null;
    if (!trial && !renewal) break;

    if (trial && (!renewal || trial.trialEndsAt! < renewal)) {
      const at = trial.trialEndsAt!;
      if (isFree(trial.moduleType)) {
        trial.status = ModuleStatus.ACTIVE;
      } else if (!poi.paymentMethodLabel) {
        trial.status = ModuleStatus.EXPIRED;
      } else {
        invoices.push({ issuedAt: at, lines: [startPaying(poi, trial, at)] });
      }
      continue;
    }

    const at = renewal!;
    const next = addInterval(at, poi.billingInterval);
    const lines: InvoiceDraft['lines'] = [];
    for (const module of modules) {
      if (module.status !== ModuleStatus.ACTIVE || isFree(module.moduleType) || module.offered) continue;
      if (!module.paidUntil || module.paidUntil > at) continue;
      if (module.cancelAtPeriodEnd) {
        module.status = ModuleStatus.CANCELLED;
        module.cancelAtPeriodEnd = false;
      } else if (!poi.paymentMethodLabel) {
        module.status = ModuleStatus.EXPIRED;
      } else {
        module.paidUntil = next;
        lines.push({
          moduleType: module.moduleType,
          amount: PRICES[poi.billingInterval],
          periodStart: at.toISOString(),
          periodEnd: next.toISOString(),
        });
      }
    }
    if (lines.length) invoices.push({ issuedAt: at, lines });
    poi.billingRenewsAt = lines.length ? next : null;
  }
  return invoices;
}

export function isLive(module: BillingModule): boolean {
  return module.status === ModuleStatus.TRIAL || module.status === ModuleStatus.ACTIVE;
}
