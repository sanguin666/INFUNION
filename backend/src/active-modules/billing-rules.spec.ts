import { describe, expect, it } from 'vitest';
import { ModuleType } from '../common/enums/module-type.enum.js';
import { ModuleStatus } from '../common/enums/module-status.enum.js';
import { BillingInterval } from '../common/enums/billing-interval.enum.js';
import { PlanTier } from '../common/enums/plan-tier.enum.js';
import {
  addMonths,
  alignModules,
  choosePlan,
  planIncludes,
  planPrice,
  sendsNotifications,
  settle,
  startTrial,
  type BillingModule,
  type BillingPoi,
} from './billing-rules.js';

const d = (iso: string) => new Date(`${iso}T09:00:00Z`);

function place(overrides: Partial<BillingPoi> = {}): BillingPoi {
  return {
    plan: PlanTier.BASIC,
    planTrialEndsAt: null,
    planTrialUsed: false,
    pendingPlan: null,
    planOffered: false,
    billingInterval: BillingInterval.YEARLY,
    billingComped: false,
    paymentMethodLabel: 'SEPA •••• 4521',
    billingRenewsAt: null,
    ...overrides,
  };
}

describe('plan rules', () => {
  it('prices a year at ten months', () => {
    expect(planPrice(PlanTier.ESSENTIALS, BillingInterval.MONTHLY)).toBe(39);
    expect(planPrice(PlanTier.ESSENTIALS, BillingInterval.YEARLY)).toBe(390);
    expect(planPrice(PlanTier.COMPLETE, BillingInterval.YEARLY)).toBe(590);
    expect(planPrice(PlanTier.BASIC, BillingInterval.YEARLY)).toBe(0);
  });

  it('puts each module in its plan and the plans above', () => {
    expect(planIncludes(PlanTier.BASIC, ModuleType.EVENTS)).toBe(true);
    expect(planIncludes(PlanTier.BASIC, ModuleType.ANNOUNCEMENTS)).toBe(false);
    expect(planIncludes(PlanTier.ESSENTIALS, ModuleType.ANNOUNCEMENTS)).toBe(true);
    expect(planIncludes(PlanTier.BASIC, ModuleType.MESSAGES)).toBe(false);
    expect(planIncludes(PlanTier.ESSENTIALS, ModuleType.REQUESTS)).toBe(true);
    expect(planIncludes(PlanTier.ESSENTIALS, ModuleType.COMMUNITY)).toBe(false);
    expect(planIncludes(PlanTier.COMPLETE, ModuleType.MASS_INTENTIONS)).toBe(true);
  });

  it('sends notifications from Essentials up, and for an "Offert" place', () => {
    expect(sendsNotifications(place())).toBe(false);
    expect(sendsNotifications(place({ plan: PlanTier.ESSENTIALS }))).toBe(true);
    expect(sendsNotifications(place({ billingComped: true }))).toBe(true);
  });

  it('keeps the day of the month, or the last day when it is missing', () => {
    expect(addMonths(d('2026-01-31'), 1).toISOString().slice(0, 10)).toBe('2026-02-28');
  });

  it('gives one free month, once', () => {
    const poi = place();
    startTrial(poi, PlanTier.COMPLETE, d('2026-10-29'));
    expect(poi.plan).toBe(PlanTier.COMPLETE);
    expect(poi.planTrialEndsAt).toEqual(d('2026-11-29'));
    expect(settle(poi, d('2026-11-20'))).toEqual([]);
    choosePlan(poi, PlanTier.BASIC, d('2026-11-20'));
    expect(() => startTrial(poi, PlanTier.ESSENTIALS, d('2026-11-21'))).toThrow('trial_used');
  });

  it('pays for the plan when the free month ends with a payment method', () => {
    const poi = place();
    startTrial(poi, PlanTier.ESSENTIALS, d('2026-10-29'));
    const invoices = settle(poi, d('2026-12-01'));
    expect(invoices).toHaveLength(1);
    expect(invoices[0].lines[0]).toMatchObject({ plan: PlanTier.ESSENTIALS, amount: 390 });
    expect(poi.planTrialEndsAt).toBeNull();
    expect(poi.billingRenewsAt).toEqual(d('2027-11-29'));
  });

  it('ends on Basic when the free month ends without a payment method', () => {
    const poi = place({ paymentMethodLabel: null });
    startTrial(poi, PlanTier.COMPLETE, d('2026-10-29'));
    expect(settle(poi, d('2026-12-01'))).toEqual([]);
    expect(poi.plan).toBe(PlanTier.BASIC);
  });

  it('keeps the free month going when moving up during it', () => {
    const poi = place({ paymentMethodLabel: null });
    startTrial(poi, PlanTier.ESSENTIALS, d('2026-10-29'));
    expect(choosePlan(poi, PlanTier.COMPLETE, d('2026-11-05'))).toBeNull();
    expect(poi.plan).toBe(PlanTier.COMPLETE);
    expect(poi.planTrialEndsAt).toEqual(d('2026-11-29'));
  });

  it('charges a full period when moving up from Basic', () => {
    const poi = place({ billingInterval: BillingInterval.MONTHLY, planTrialUsed: true });
    const invoice = choosePlan(poi, PlanTier.ESSENTIALS, d('2026-10-29'));
    expect(invoice?.lines[0].amount).toBe(39);
    expect(poi.billingRenewsAt).toEqual(d('2026-11-29'));
  });

  it('needs a payment method to pay', () => {
    const poi = place({ paymentMethodLabel: null, planTrialUsed: true });
    expect(() => choosePlan(poi, PlanTier.ESSENTIALS, d('2026-10-29'))).toThrow('payment_method_required');
  });

  it('charges the difference, pro rata, when moving up a paid plan', () => {
    const poi = place({ billingInterval: BillingInterval.MONTHLY, planTrialUsed: true });
    choosePlan(poi, PlanTier.ESSENTIALS, d('2026-11-01'));
    // Half of November left: half of the 20 € difference.
    const invoice = choosePlan(poi, PlanTier.COMPLETE, d('2026-11-16'));
    expect(invoice?.lines[0].amount).toBe(10);
    expect(poi.plan).toBe(PlanTier.COMPLETE);
    expect(poi.billingRenewsAt).toEqual(d('2026-12-01'));
  });

  it('moves down on the renewal date, and renews at the smaller price', () => {
    const poi = place({ billingInterval: BillingInterval.MONTHLY, planTrialUsed: true });
    choosePlan(poi, PlanTier.COMPLETE, d('2026-11-01'));
    expect(choosePlan(poi, PlanTier.ESSENTIALS, d('2026-11-10'))).toBeNull();
    expect(poi.plan).toBe(PlanTier.COMPLETE);
    const invoices = settle(poi, d('2026-12-02'));
    expect(poi.plan).toBe(PlanTier.ESSENTIALS);
    expect(invoices[0].lines[0].amount).toBe(39);
  });

  it('stops paying at the end of the period when Basic is chosen', () => {
    const poi = place({ planTrialUsed: true });
    choosePlan(poi, PlanTier.ESSENTIALS, d('2026-11-01'));
    choosePlan(poi, PlanTier.BASIC, d('2026-12-01'));
    expect(poi.plan).toBe(PlanTier.ESSENTIALS);
    expect(settle(poi, d('2027-11-02'))).toEqual([]);
    expect(poi.plan).toBe(PlanTier.BASIC);
    expect(poi.billingRenewsAt).toBeNull();
  });

  it('never bills an offered plan or an "Offert" place', () => {
    expect(settle(place({ plan: PlanTier.COMPLETE, planOffered: true, billingRenewsAt: d('2026-01-01') }), d('2026-12-01'))).toEqual([]);
    expect(settle(place({ billingComped: true, billingRenewsAt: d('2026-01-01') }), d('2026-12-01'))).toEqual([]);
  });

  it('pauses the modules a smaller plan does not have, and brings them back', () => {
    const poi = place({ plan: PlanTier.ESSENTIALS });
    const modules: BillingModule[] = [
      { moduleType: ModuleType.MESSAGES, status: ModuleStatus.ACTIVE },
      { moduleType: ModuleType.COMMUNITY, status: ModuleStatus.ACTIVE },
      { moduleType: ModuleType.LIVESTREAMS, status: ModuleStatus.ACTIVE, offered: true },
      { moduleType: ModuleType.REQUESTS, status: ModuleStatus.CANCELLED },
    ];
    alignModules(poi, modules);
    expect(modules.map((m) => m.status)).toEqual([
      ModuleStatus.ACTIVE,
      ModuleStatus.EXPIRED,
      ModuleStatus.ACTIVE,
      ModuleStatus.CANCELLED,
    ]);
    poi.plan = PlanTier.COMPLETE;
    alignModules(poi, modules);
    expect(modules[1].status).toBe(ModuleStatus.ACTIVE);
  });
});
