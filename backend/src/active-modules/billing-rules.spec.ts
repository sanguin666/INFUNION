import { describe, expect, it } from 'vitest';
import { ModuleType } from '../common/enums/module-type.enum.js';
import { ModuleStatus } from '../common/enums/module-status.enum.js';
import { BillingInterval } from '../common/enums/billing-interval.enum.js';
import { addMonths, isFree, settle, startPaying, type BillingModule, type BillingPoi } from './billing-rules.js';

const d = (iso: string) => new Date(`${iso}T09:00:00Z`);

function place(overrides: Partial<BillingPoi> = {}): BillingPoi {
  return {
    billingInterval: BillingInterval.MONTHLY,
    billingComped: false,
    paymentMethodLabel: 'SEPA •••• 4521',
    billingRenewsAt: null,
    ...overrides,
  };
}

function trial(type: ModuleType, endsAt: string): BillingModule {
  return { moduleType: type, status: ModuleStatus.TRIAL, trialEndsAt: d(endsAt), cancelAtPeriodEnd: false };
}

describe('billing rules', () => {
  it('keeps Événements and Dons free, and charges for the rest', () => {
    expect(isFree(ModuleType.EVENTS)).toBe(true);
    expect(isFree(ModuleType.DONATIONS)).toBe(true);
    expect(isFree(ModuleType.REQUESTS)).toBe(false);
  });


  it('keeps the day of the month, or the last day when it is missing', () => {
    expect(addMonths(d('2026-01-31'), 1).toISOString().slice(0, 10)).toBe('2026-02-28');
    expect(addMonths(d('2026-09-30'), 12).toISOString().slice(0, 10)).toBe('2027-09-30');
  });

  it('leaves a trial alone until its month is over', () => {
    const modules = [trial(ModuleType.ANNOUNCEMENTS, '2026-10-30')];
    expect(settle(place(), modules, d('2026-10-29'))).toEqual([]);
    expect(modules[0].status).toBe(ModuleStatus.TRIAL);
  });

  it('turns an ended trial into a paid month when a payment method is on file', () => {
    const poi = place();
    const modules = [trial(ModuleType.ANNOUNCEMENTS, '2026-10-30')];
    const invoices = settle(poi, modules, d('2026-11-02'));
    expect(invoices).toHaveLength(1);
    expect(invoices[0].lines[0].amount).toBe(10);
    expect(modules[0].status).toBe(ModuleStatus.ACTIVE);
    expect(poi.billingRenewsAt).toEqual(d('2026-11-30'));
  });

  it('pauses an ended trial without a payment method', () => {
    const modules = [trial(ModuleType.ANNOUNCEMENTS, '2026-10-30')];
    expect(settle(place({ paymentMethodLabel: null }), modules, d('2026-11-02'))).toEqual([]);
    expect(modules[0].status).toBe(ModuleStatus.EXPIRED);
  });

  it('bills a second module pro rata up to the shared renewal date', () => {
    const poi = place({ billingRenewsAt: d('2026-11-30') });
    const module: BillingModule = { moduleType: ModuleType.REQUESTS, status: ModuleStatus.EXPIRED, cancelAtPeriodEnd: false };
    const line = startPaying(poi, module, d('2026-11-15'));
    // 15 days left of the 31 from 30 Oct to 30 Nov.
    expect(line.amount).toBe(4.84);
    expect(module.paidUntil).toEqual(d('2026-11-30'));
  });

  it('renews every paid module on one invoice, and stops those the office stopped', () => {
    const poi = place({ billingRenewsAt: d('2026-11-30') });
    const modules: BillingModule[] = [
      { moduleType: ModuleType.REQUESTS, status: ModuleStatus.ACTIVE, paidUntil: d('2026-11-30'), cancelAtPeriodEnd: false },
      { moduleType: ModuleType.ANNOUNCEMENTS, status: ModuleStatus.ACTIVE, paidUntil: d('2026-11-30'), cancelAtPeriodEnd: false },
      { moduleType: ModuleType.LIVESTREAMS, status: ModuleStatus.ACTIVE, paidUntil: d('2026-11-30'), cancelAtPeriodEnd: true },
      { moduleType: ModuleType.EVENTS, status: ModuleStatus.ACTIVE, cancelAtPeriodEnd: false },
    ];
    const invoices = settle(poi, modules, d('2026-12-01'));
    expect(invoices).toHaveLength(1);
    expect(invoices[0].lines.map((l) => l.moduleType)).toEqual([ModuleType.REQUESTS, ModuleType.ANNOUNCEMENTS]);
    expect(modules[2].status).toBe(ModuleStatus.CANCELLED);
    expect(modules[3].status).toBe(ModuleStatus.ACTIVE);
    expect(poi.billingRenewsAt).toEqual(d('2026-12-30'));
  });

  it('charges 110 for a year', () => {
    const poi = place({ billingInterval: BillingInterval.YEARLY });
    const modules = [trial(ModuleType.ANNOUNCEMENTS, '2026-10-30')];
    const invoices = settle(poi, modules, d('2026-10-31'));
    expect(invoices[0].lines[0].amount).toBe(110);
    expect(poi.billingRenewsAt).toEqual(d('2027-10-30'));
  });

  it('catches up on several missed months at once', () => {
    const poi = place({ billingRenewsAt: d('2026-11-30') });
    const modules: BillingModule[] = [
      { moduleType: ModuleType.REQUESTS, status: ModuleStatus.ACTIVE, paidUntil: d('2026-11-30'), cancelAtPeriodEnd: false },
    ];
    expect(settle(poi, modules, d('2027-02-01'))).toHaveLength(3);
    expect(poi.billingRenewsAt).toEqual(d('2027-02-28'));
  });

  it('never touches an offered community', () => {
    const modules = [trial(ModuleType.ANNOUNCEMENTS, '2026-10-30')];
    expect(settle(place({ billingComped: true, paymentMethodLabel: null }), modules, d('2027-01-01'))).toEqual([]);
    expect(modules[0].status).toBe(ModuleStatus.TRIAL);
  });

  it('never bills or pauses a module INFUNION offered', () => {
    const poi = place({ billingRenewsAt: d('2026-11-30'), paymentMethodLabel: null });
    const modules: BillingModule[] = [
      { moduleType: ModuleType.REQUESTS, status: ModuleStatus.ACTIVE, paidUntil: null, cancelAtPeriodEnd: false, offered: true },
    ];
    expect(settle(poi, modules, d('2027-03-01'))).toEqual([]);
    expect(modules[0].status).toBe(ModuleStatus.ACTIVE);
  });
});
