import { ModuleType } from '../common/enums/module-type.enum.js';
import { ModuleStatus } from '../common/enums/module-status.enum.js';
import { BillingInterval } from '../common/enums/billing-interval.enum.js';
import { PlanTier } from '../common/enums/plan-tier.enum.js';

/**
 * infunion's plans (Seb, 29 Oct 2026), replacing the 10 €-per-module prices:
 * Basic is free, Essentials 39 € a month and Complete 59 € a month.
 * A year costs ten months: two months free. A paid plan can be tried free for a
 * month, once per community. Dons stays free in every plan: infunion keeps a
 * small share of each gift instead (see donations/platform-fee.ts).
 *
 * The rules are plain functions over plain objects so they can be tested
 * without a database; ModuleBillingService loads and saves around them.
 */
export const PLAN_ORDER: readonly PlanTier[] = [PlanTier.BASIC, PlanTier.ESSENTIALS, PlanTier.COMPLETE];

const MONTHLY: Record<PlanTier, number> = {
  [PlanTier.BASIC]: 0,
  [PlanTier.ESSENTIALS]: 39,
  [PlanTier.COMPLETE]: 59,
};

// Paying for the year costs this many months (Seb: round numbers).
export const MONTHS_PAID_PER_YEAR = 10;

function roundCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function planPrice(tier: PlanTier, interval: BillingInterval): number {
  const month = MONTHLY[tier];
  return interval === BillingInterval.YEARLY ? roundCents(month * MONTHS_PAID_PER_YEAR) : month;
}

/** What a plan costs spread over a month, for the superadmin's figures. */
export function monthlyEquivalent(tier: PlanTier, interval: BillingInterval): number {
  return interval === BillingInterval.YEARLY ? planPrice(tier, interval) / 12 : planPrice(tier, interval);
}

// Each plan's own modules; a plan also has everything in the plans below it.
const ADDS: Record<PlanTier, readonly ModuleType[]> = {
  [PlanTier.BASIC]: [ModuleType.EVENTS, ModuleType.DONATIONS],
  [PlanTier.ESSENTIALS]: [ModuleType.ANNOUNCEMENTS, ModuleType.REQUESTS, ModuleType.MESSAGES],
  [PlanTier.COMPLETE]: [
    ModuleType.COMMUNITY,
    ModuleType.LIVESTREAMS,
    ModuleType.PRAYER_REQUESTS,
    ModuleType.DAILY_READINGS,
    ModuleType.MASS_INTENTIONS,
  ],
};

export function rank(tier: PlanTier): number {
  return PLAN_ORDER.indexOf(tier);
}

/** The smallest plan that has this module. */
export function planOf(type: ModuleType): PlanTier {
  return PLAN_ORDER.find((tier) => ADDS[tier].includes(type)) ?? PlanTier.COMPLETE;
}

export function planIncludes(tier: PlanTier, type: ModuleType): boolean {
  return rank(planOf(type)) <= rank(tier);
}

/** Every module of a plan, in enum order (before the place's kind is applied). */
export function planModules(tier: PlanTier): ModuleType[] {
  return Object.values(ModuleType).filter((type) => planIncludes(tier, type));
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

export type BillingPoi = {
  plan: PlanTier;
  // Set while the plan is a free month; cleared when it is paid or ends.
  planTrialEndsAt?: Date | null;
  planTrialUsed: boolean;
  // A smaller plan chosen while a bigger one is paid: it starts on the
  // renewal date.
  pendingPlan?: PlanTier | null;
  // Given by infunion (superadmin): never billed, never ends.
  planOffered: boolean;
  billingInterval: BillingInterval;
  billingComped: boolean;
  paymentMethodLabel?: string | null;
  // The plan is paid up to here, and renews on it. null while nothing is paid.
  billingRenewsAt?: Date | null;
};

export type InvoiceLine = { plan: PlanTier; amount: number; periodStart: string; periodEnd: string };
export type InvoiceDraft = { issuedAt: Date; lines: InvoiceLine[] };

/** The plan whose modules the place gets: Complete for an "Offert" one. */
export function effectivePlan(poi: BillingPoi): PlanTier {
  return poi.billingComped ? PlanTier.COMPLETE : poi.plan;
}

/**
 * Push notifications to members' phones come with Essentials and up (Seb,
 * 29 Oct 2026): on Basic, members come to the app for the news.
 */
export function sendsNotifications(poi: Pick<BillingPoi, 'plan' | 'billingComped'>): boolean {
  return poi.billingComped || poi.plan !== PlanTier.BASIC;
}

/** True while the plan is paid for (not Basic, not a trial, not a gift). */
export function isPaying(poi: BillingPoi): boolean {
  return !poi.billingComped && !poi.planOffered && poi.plan !== PlanTier.BASIC && !poi.planTrialEndsAt;
}

function charge(poi: BillingPoi, at: Date): InvoiceDraft {
  const end = addInterval(at, poi.billingInterval);
  poi.billingRenewsAt = end;
  poi.planTrialEndsAt = null;
  return {
    issuedAt: at,
    lines: [{ plan: poi.plan, amount: planPrice(poi.plan, poi.billingInterval), periodStart: at.toISOString(), periodEnd: end.toISOString() }],
  };
}

function dropToBasic(poi: BillingPoi): void {
  poi.plan = PlanTier.BASIC;
  poi.planTrialEndsAt = null;
  poi.pendingPlan = null;
  poi.billingRenewsAt = null;
}

/** "Essayer 1 mois gratuit": once per community, on a paid plan. */
export function startTrial(poi: BillingPoi, tier: PlanTier, now: Date): void {
  if (tier === PlanTier.BASIC) throw new Error('no_trial_for_basic');
  if (poi.planTrialUsed) throw new Error('trial_used');
  if (isPaying(poi) || poi.planOffered) throw new Error('already_paying');
  poi.plan = tier;
  poi.planTrialUsed = true;
  poi.planTrialEndsAt = addMonths(now, 1);
  poi.pendingPlan = null;
}

/**
 * Moves to another plan. Bigger: now, paying the difference up to the
 * renewal date, or a full period when nothing is paid yet (from Basic);
 * during a free month the month simply carries on. Smaller: on the renewal date; during a trial, now. Basic is
 * the smallest, so choosing it stops paying at the end of the period.
 * Returns the invoice to record, if any; mutates poi.
 */
export function choosePlan(poi: BillingPoi, tier: PlanTier, now: Date): InvoiceDraft | null {
  if (poi.billingComped || poi.planOffered) throw new Error('plan_offered');
  if (tier === poi.plan) {
    // Choosing the plan already on drops a smaller one planned for later,
    // and pays for a trial straight away.
    poi.pendingPlan = null;
    if (!poi.planTrialEndsAt) return null;
    if (!poi.paymentMethodLabel) throw new Error('payment_method_required');
    return charge(poi, now);
  }
  if (rank(tier) < rank(poi.plan)) {
    if (poi.planTrialEndsAt || !isPaying(poi) || !poi.billingRenewsAt || poi.billingRenewsAt <= now) {
      if (tier === PlanTier.BASIC) dropToBasic(poi);
      else poi.plan = tier;
      return null;
    }
    poi.pendingPlan = tier;
    return null;
  }
  if (poi.planTrialEndsAt) {
    // A bigger plan during the free month: the month carries on with it.
    poi.plan = tier;
    poi.pendingPlan = null;
    return null;
  }
  if (!poi.paymentMethodLabel) throw new Error('payment_method_required');
  const from = poi.plan;
  poi.pendingPlan = null;
  if (isPaying(poi) && poi.billingRenewsAt && poi.billingRenewsAt > now) {
    // The share of the period that is left, at the difference in price.
    const back = addMonths(poi.billingRenewsAt, poi.billingInterval === BillingInterval.YEARLY ? -12 : -1);
    const whole = poi.billingRenewsAt.getTime() - back.getTime();
    const left = poi.billingRenewsAt.getTime() - now.getTime();
    const difference = planPrice(tier, poi.billingInterval) - planPrice(from, poi.billingInterval);
    poi.plan = tier;
    return {
      issuedAt: now,
      lines: [{ plan: tier, amount: roundCents((difference * left) / whole), periodStart: now.toISOString(), periodEnd: poi.billingRenewsAt.toISOString() }],
    };
  }
  poi.plan = tier;
  return charge(poi, now);
}

/**
 * Brings a community's plan up to `now`: a free month that ended is paid
 * (with a payment method) or ends on Basic (without one), and a paid plan
 * renews, moves to the smaller plan chosen, or ends on Basic (no payment
 * method) on its renewal date. Returns the invoices to record; mutates poi.
 */
export function settle(poi: BillingPoi, now: Date): InvoiceDraft[] {
  if (poi.billingComped || poi.planOffered) return [];
  const invoices: InvoiceDraft[] = [];
  for (let guard = 0; guard < 500; guard++) {
    if (poi.planTrialEndsAt) {
      if (poi.planTrialEndsAt > now) break;
      const at = poi.planTrialEndsAt;
      if (!poi.paymentMethodLabel) {
        dropToBasic(poi);
        break;
      }
      invoices.push(charge(poi, at));
      continue;
    }
    if (!poi.billingRenewsAt || poi.billingRenewsAt > now) break;
    const at = poi.billingRenewsAt;
    if (poi.pendingPlan) {
      poi.plan = poi.pendingPlan;
      poi.pendingPlan = null;
    }
    if (poi.plan === PlanTier.BASIC || !poi.paymentMethodLabel) {
      dropToBasic(poi);
      break;
    }
    invoices.push(charge(poi, at));
  }
  return invoices;
}

export type BillingModule = {
  moduleType: ModuleType;
  status: ModuleStatus;
  offered?: boolean;
};

/**
 * Lines the modules up with the plan. A module is shown (ACTIVE) or hidden
 * by the office (CANCELLED); one the office wants but the plan no longer
 * has waits, paused (EXPIRED), and comes back by itself with a plan that
 * has it. Modules given by infunion stay on whatever the plan. Returns the
 * modules whose status changed.
 */
export function alignModules(poi: BillingPoi, modules: BillingModule[]): BillingModule[] {
  const tier = effectivePlan(poi);
  const changed: BillingModule[] = [];
  for (const module of modules) {
    const allowed = module.offered || planIncludes(tier, module.moduleType);
    let status = module.status;
    if (status === ModuleStatus.TRIAL) status = ModuleStatus.ACTIVE; // from the per-module days
    if (status === ModuleStatus.ACTIVE && !allowed) status = ModuleStatus.EXPIRED;
    else if (status === ModuleStatus.EXPIRED && allowed) status = ModuleStatus.ACTIVE;
    if (status !== module.status) {
      module.status = status;
      changed.push(module);
    }
  }
  return changed;
}

export function isLive(module: { status: ModuleStatus }): boolean {
  return module.status === ModuleStatus.TRIAL || module.status === ModuleStatus.ACTIVE;
}
