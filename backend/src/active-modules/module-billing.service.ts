import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActiveModule } from './entities/active-module.entity.js';
import { BillingInvoice } from './entities/billing-invoice.entity.js';
import { Poi } from '../pois/entities/poi.entity.js';
import { ModuleType } from '../common/enums/module-type.enum.js';
import { ModuleStatus } from '../common/enums/module-status.enum.js';
import { BillingInterval } from '../common/enums/billing-interval.enum.js';
import { FREE_MODULES, PRICES, addMonths, isFree, isLive, settle, startPaying } from './billing-rules.js';

export type BillingSummary = {
  interval: BillingInterval;
  comped: boolean;
  paymentMethod: string | null;
  renewsAt: string | null;
  prices: Record<BillingInterval, number>;
  freeModules: ModuleType[];
  modules: ActiveModule[];
  invoices: BillingInvoice[];
};

/**
 * Paid modules for a community: free trials, monthly or yearly renewal on
 * one date, stopping at the end of the paid period. The rules themselves
 * are in billing-rules.ts.
 *
 * Demo stage (Seb, 30 Sep 2026): no payment provider is wired yet, so a
 * payment method is only a label and an invoice records what would have
 * been charged. Stripe Billing plugs in behind startPaying and settle's
 * renewals when real charges are wanted.
 */
@Injectable()
export class ModuleBillingService {
  constructor(
    @InjectRepository(ActiveModule)
    private readonly modules: Repository<ActiveModule>,
    @InjectRepository(BillingInvoice)
    private readonly invoices: Repository<BillingInvoice>,
    @InjectRepository(Poi)
    private readonly pois: Repository<Poi>,
  ) {}

  private async load(poiId: string): Promise<{ poi: Poi; modules: ActiveModule[] }> {
    const poi = await this.pois.findOne({ where: { id: poiId } });
    if (!poi) throw new BadRequestException('Unknown place');
    const modules = await this.modules.find({ where: { poi: { id: poiId } } });
    return { poi, modules };
  }

  private async save(poi: Poi, modules: ActiveModule[], drafts: ReturnType<typeof settle>): Promise<void> {
    await this.pois.update(poi.id, {
      billingRenewsAt: poi.billingRenewsAt ?? null,
    });
    await this.modules.save(modules);
    for (const draft of drafts) {
      await this.invoices.save(
        this.invoices.create({
          poi: { id: poi.id },
          issuedAt: draft.issuedAt,
          amount: Math.round(draft.lines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100,
          lines: draft.lines,
        }),
      );
    }
  }

  /** Brings the place's modules up to now: ended trials, renewals. */
  async settle(poiId: string, now = new Date()): Promise<ActiveModule[]> {
    if (!(await this.pois.exists({ where: { id: poiId } }))) return [];
    const { poi, modules } = await this.load(poiId);
    const before = JSON.stringify([poi.billingRenewsAt, modules]);
    const drafts = settle(poi, modules, now);
    if (drafts.length || JSON.stringify([poi.billingRenewsAt, modules]) !== before) {
      await this.save(poi, modules, drafts);
    }
    return modules;
  }

  async summary(poiId: string): Promise<BillingSummary> {
    const modules = await this.settle(poiId);
    const poi = await this.pois.findOneOrFail({ where: { id: poiId } });
    const invoices = await this.invoices.find({
      where: { poi: { id: poiId } },
      order: { issuedAt: 'DESC' },
      take: 24,
    });
    return {
      interval: poi.billingInterval,
      comped: poi.billingComped,
      paymentMethod: poi.paymentMethodLabel ?? null,
      renewsAt: poi.billingRenewsAt ? poi.billingRenewsAt.toISOString() : null,
      prices: PRICES,
      freeModules: [...FREE_MODULES],
      modules,
      invoices,
    };
  }

  /**
   * "Essayer 1 mois gratuit", or simply "Activer" for a free module or a
   * community that pays nothing. A paid module that has had its trial
   * goes through subscribe instead.
   */
  async start(poiId: string, type: ModuleType, now = new Date()): Promise<BillingSummary> {
    const { poi, modules } = await this.load(poiId);
    settle(poi, modules, now);
    const existing = modules.find((m) => m.moduleType === type);
    if (existing && isLive(existing)) throw new ConflictException('Module already on');
    if (isFree(type) || poi.billingComped) {
      const row = existing ?? this.modules.create({ poi: { id: poiId }, moduleType: type });
      row.status = ModuleStatus.ACTIVE;
      row.cancelAtPeriodEnd = false;
      if (!existing) modules.push(row);
      await this.save(poi, modules, []);
      return this.summary(poiId);
    }
    if (existing) throw new ConflictException('trial_used');
    modules.push(
      this.modules.create({
        poi: { id: poiId },
        moduleType: type,
        status: ModuleStatus.TRIAL,
        startDate: now,
        trialEndsAt: addMonths(now, 1),
        cancelAtPeriodEnd: false,
      }),
    );
    await this.save(poi, modules, []);
    return this.summary(poiId);
  }

  /** Pays for a paid module straight away (its trial already used). */
  async subscribe(poiId: string, type: ModuleType, now = new Date()): Promise<BillingSummary> {
    const { poi, modules } = await this.load(poiId);
    const drafts = settle(poi, modules, now);
    if (isFree(type) || poi.billingComped) return this.start(poiId, type, now);
    if (!poi.paymentMethodLabel) throw new BadRequestException('payment_method_required');
    let row = modules.find((m) => m.moduleType === type);
    if (row && isLive(row)) throw new ConflictException('Module already on');
    if (!row) {
      row = this.modules.create({ poi: { id: poiId }, moduleType: type, startDate: now, cancelAtPeriodEnd: false });
      modules.push(row);
    }
    drafts.push({ issuedAt: now, lines: [startPaying(poi, row, now)] });
    await this.save(poi, modules, drafts);
    return this.summary(poiId);
  }

  /**
   * "Arrêter": a trial, a free module or an offered one stops now; a paid
   * one stays on until the end of what was paid for.
   */
  async stop(poiId: string, type: ModuleType, now = new Date()): Promise<BillingSummary> {
    const { poi, modules } = await this.load(poiId);
    const drafts = settle(poi, modules, now);
    const row = modules.find((m) => m.moduleType === type);
    if (!row || !isLive(row)) throw new ConflictException('Module already off');
    if (row.status === ModuleStatus.ACTIVE && !isFree(type) && !poi.billingComped && !row.offered && row.paidUntil) {
      row.cancelAtPeriodEnd = true;
    } else {
      row.status = ModuleStatus.CANCELLED;
    }
    await this.save(poi, modules, drafts);
    return this.summary(poiId);
  }

  /** "Non, garder": takes back a stop that has not happened yet. */
  async resume(poiId: string, type: ModuleType): Promise<BillingSummary> {
    const row = await this.modules.findOne({ where: { poi: { id: poiId }, moduleType: type } });
    if (!row || !row.cancelAtPeriodEnd) throw new ConflictException('Nothing to resume');
    row.cancelAtPeriodEnd = false;
    await this.modules.save(row);
    return this.summary(poiId);
  }

  /**
   * Superadmin: gives one module to a community (Seb, 17 Oct 2026). It is
   * switched on now, whatever it was, and no renewal ever bills it.
   */
  async offer(poiId: string, type: ModuleType, now = new Date()): Promise<BillingSummary> {
    const { poi, modules } = await this.load(poiId);
    const drafts = settle(poi, modules, now);
    let row = modules.find((m) => m.moduleType === type);
    if (!row) {
      row = this.modules.create({ poi: { id: poiId }, moduleType: type, startDate: now });
      modules.push(row);
    }
    row.status = ModuleStatus.ACTIVE;
    row.offered = true;
    row.paidUntil = null;
    row.cancelAtPeriodEnd = false;
    await this.save(poi, modules, drafts);
    return this.summary(poiId);
  }

  /**
   * Superadmin: takes a gift back. The module stops now, unless it would
   * be free anyway (Événements, or a community that is "Offert").
   */
  async unoffer(poiId: string, type: ModuleType): Promise<BillingSummary> {
    const { poi, modules } = await this.load(poiId);
    const row = modules.find((m) => m.moduleType === type);
    if (!row?.offered) throw new ConflictException('Module not offered');
    row.offered = false;
    if (!isFree(type) && !poi.billingComped) row.status = ModuleStatus.CANCELLED;
    await this.save(poi, modules, []);
    return this.summary(poiId);
  }

  /**
   * Superadmin: one more free month. A running trial gets a month on its
   * end date; a module that is off and unpaid starts a new month from now.
   */
  async extendTrial(poiId: string, type: ModuleType, now = new Date()): Promise<BillingSummary> {
    const { poi, modules } = await this.load(poiId);
    const drafts = settle(poi, modules, now);
    let row = modules.find((m) => m.moduleType === type);
    if (row?.status === ModuleStatus.TRIAL && row.trialEndsAt) {
      row.trialEndsAt = addMonths(row.trialEndsAt, 1);
    } else if (!row || !isLive(row)) {
      if (!row) {
        row = this.modules.create({ poi: { id: poiId }, moduleType: type });
        modules.push(row);
      }
      row.status = ModuleStatus.TRIAL;
      row.startDate = now;
      row.trialEndsAt = addMonths(now, 1);
      row.cancelAtPeriodEnd = false;
    } else {
      throw new ConflictException('Module already paid or offered');
    }
    await this.save(poi, modules, drafts);
    return this.summary(poiId);
  }

  /** Takes effect on the next renewal date. */
  async setInterval(poiId: string, interval: BillingInterval): Promise<BillingSummary> {
    await this.pois.update(poiId, { billingInterval: interval });
    return this.summary(poiId);
  }

  async setPaymentMethod(poiId: string, label: string | null): Promise<BillingSummary> {
    await this.pois.update(poiId, { paymentMethodLabel: label });
    return this.summary(poiId);
  }
}
