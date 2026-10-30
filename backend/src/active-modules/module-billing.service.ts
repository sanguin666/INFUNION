import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { ActiveModule } from './entities/active-module.entity.js';
import { BillingInvoice } from './entities/billing-invoice.entity.js';
import { PlanTrial } from './entities/plan-trial.entity.js';
import { Poi } from '../pois/entities/poi.entity.js';
import { ModuleType } from '../common/enums/module-type.enum.js';
import { ModuleStatus } from '../common/enums/module-status.enum.js';
import { BillingInterval } from '../common/enums/billing-interval.enum.js';
import { PlanTier } from '../common/enums/plan-tier.enum.js';
import { moduleFitsPlace, modulesForPlace } from './module-places.js';
import { normalizeTaxId } from '../registrations/registration-rules.js';
import {
  PLAN_ORDER,
  addMonths,
  alignModules,
  choosePlan,
  effectivePlan,
  isLive,
  planIncludes,
  planOf,
  planPrice,
  settle,
  startTrial,
  type InvoiceDraft,
} from './billing-rules.js';

export type PlanOffer = {
  tier: PlanTier;
  prices: Record<BillingInterval, number>;
  // The modules this plan adds to the one below, for this kind of place.
  adds: ModuleType[];
};

export type BillingSummary = {
  interval: BillingInterval;
  comped: boolean;
  paymentMethod: string | null;
  renewsAt: string | null;
  plan: PlanTier;
  planOffered: boolean;
  trialEndsAt: string | null;
  trialUsed: boolean;
  pendingPlan: PlanTier | null;
  plans: PlanOffer[];
  // The modules this kind of place can have (Mass intentions only for a
  // church…), so the Modules page never offers one that does not fit.
  availableModules: ModuleType[];
  modules: ActiveModule[];
  invoices: BillingInvoice[];
};

/**
 * A community's plan and modules: the free month, moving between plans,
 * renewals, and showing or hiding each module of the plan. The rules
 * themselves are in billing-rules.ts.
 *
 * Demo stage (Seb, 30 Sep 2026): no payment provider is wired yet, so a
 * payment method is only a label and an invoice records what would have
 * been charged. Stripe Billing plugs in behind choosePlan and settle's
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
    @InjectRepository(PlanTrial)
    private readonly trials: Repository<PlanTrial>,
  ) {}

  /**
   * The place another place of the same organisation (same tax ID) had its
   * free month in, even one deleted since; null if none did.
   */
  async trialTakenBy(taxId: string | null | undefined, exceptPoiId?: string): Promise<string | null> {
    const normalized = taxId ? normalizeTaxId(taxId) : '';
    if (!normalized) return null;
    const earlier = await this.trials.findOne({
      where: exceptPoiId ? { taxId: normalized, poiId: Not(exceptPoiId) } : { taxId: normalized },
      order: { startedAt: 'ASC' },
    });
    return earlier ? earlier.placeName : null;
  }

  private async recordTrial(poi: Poi): Promise<void> {
    const taxId = poi.legalTaxId ? normalizeTaxId(poi.legalTaxId) : '';
    await this.trials.save(this.trials.create({ poiId: poi.id, placeName: poi.name, taxId: taxId || null, plan: poi.plan }));
  }

  // Only the modules that fit the kind of place: one that does not (a row
  // saved before the rule, or before the place's kind changed) is left
  // as it is in the database, never shown or switched.
  private async load(poiId: string): Promise<{ poi: Poi; modules: ActiveModule[] }> {
    const poi = await this.pois.findOne({ where: { id: poiId } });
    if (!poi) throw new BadRequestException('Unknown place');
    const all = await this.modules.find({ where: { poi: { id: poiId } } });
    const modules = all.filter((m) => moduleFitsPlace(m.moduleType, poi.type));
    return { poi, modules };
  }

  private async save(poi: Poi, modules: ActiveModule[], drafts: (InvoiceDraft | null)[]): Promise<void> {
    alignModules(poi, modules);
    await this.pois.update(poi.id, {
      plan: poi.plan,
      planTrialEndsAt: poi.planTrialEndsAt ?? null,
      planTrialUsed: poi.planTrialUsed,
      pendingPlan: poi.pendingPlan ?? null,
      planOffered: poi.planOffered,
      billingRenewsAt: poi.billingRenewsAt ?? null,
    });
    await this.modules.save(modules);
    for (const draft of drafts) {
      if (!draft) continue;
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

  /**
   * Switches on, at no cost, every module of the plan this place has
   * never had a row for, so a new plan arrives with its modules showing.
   */
  private addPlanModules(poi: Poi, modules: ActiveModule[]): void {
    const tier = effectivePlan(poi);
    for (const type of modulesForPlace(poi.type)) {
      if (!planIncludes(tier, type) || modules.some((m) => m.moduleType === type)) continue;
      modules.push(this.modules.create({ poi: { id: poi.id }, moduleType: type, status: ModuleStatus.ACTIVE, startDate: new Date() }));
    }
  }

  private fail(error: unknown): never {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'trial_used' || message === 'already_paying' || message === 'plan_offered') {
      throw new ConflictException(message);
    }
    throw new BadRequestException(message);
  }

  /** Brings the place's plan up to now: ended trials, renewals. */
  async settle(poiId: string, now = new Date()): Promise<ActiveModule[]> {
    if (!(await this.pois.exists({ where: { id: poiId } }))) return [];
    const { poi, modules } = await this.load(poiId);
    const before = JSON.stringify([poi, modules]);
    const drafts = settle(poi, now);
    alignModules(poi, modules);
    if (drafts.length || JSON.stringify([poi, modules]) !== before) {
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
    const available = modulesForPlace(poi.type);
    return {
      interval: poi.billingInterval,
      comped: poi.billingComped,
      paymentMethod: poi.paymentMethodLabel ?? null,
      renewsAt: poi.billingRenewsAt ? poi.billingRenewsAt.toISOString() : null,
      plan: effectivePlan(poi),
      planOffered: poi.planOffered,
      trialEndsAt: poi.planTrialEndsAt ? poi.planTrialEndsAt.toISOString() : null,
      // Also when another place of the same organisation had it, so the
      // Modules page offers no free month it would refuse.
      trialUsed: poi.planTrialUsed || !!(await this.trialTakenBy(poi.legalTaxId, poi.id)),
      pendingPlan: poi.pendingPlan ?? null,
      plans: PLAN_ORDER.map((tier) => ({
        tier,
        prices: {
          [BillingInterval.MONTHLY]: planPrice(tier, BillingInterval.MONTHLY),
          [BillingInterval.YEARLY]: planPrice(tier, BillingInterval.YEARLY),
        },
        adds: available.filter((type) => planOf(type) === tier),
      })),
      availableModules: available,
      modules,
      invoices,
    };
  }

  /** A new community: the modules of its plan, switched on. */
  async switchOnPlanModules(poiId: string): Promise<void> {
    const { poi, modules } = await this.load(poiId);
    this.addPlanModules(poi, modules);
    await this.save(poi, modules, []);
  }

  /** "Essayer 1 mois gratuit" on Essentials or Complete, once. */
  async startTrial(poiId: string, tier: PlanTier, now = new Date()): Promise<BillingSummary> {
    const { poi, modules } = await this.load(poiId);
    const drafts = settle(poi, now);
    // Once per organisation too: a second place with the same tax ID (or
    // the same one registered again) has had its free month already.
    if (!poi.planTrialUsed && (await this.trialTakenBy(poi.legalTaxId, poi.id))) {
      poi.planTrialUsed = true;
      await this.save(poi, modules, drafts);
      throw new ConflictException('trial_used');
    }
    try {
      startTrial(poi, tier, now);
    } catch (error) {
      this.fail(error);
    }
    this.addPlanModules(poi, modules);
    await this.save(poi, modules, drafts);
    await this.recordTrial(poi);
    return this.summary(poiId);
  }

  /** Moves to another plan (see choosePlan for when it takes effect). */
  async choosePlan(poiId: string, tier: PlanTier, now = new Date()): Promise<BillingSummary> {
    const { poi, modules } = await this.load(poiId);
    const drafts: (InvoiceDraft | null)[] = settle(poi, now);
    try {
      drafts.push(choosePlan(poi, tier, now));
    } catch (error) {
      this.fail(error);
    }
    this.addPlanModules(poi, modules);
    await this.save(poi, modules, drafts);
    return this.summary(poiId);
  }

  /** Shows a module of the plan in the app (and the admin menu). */
  async show(poiId: string, type: ModuleType, now = new Date()): Promise<BillingSummary> {
    const { poi, modules } = await this.load(poiId);
    if (!moduleFitsPlace(type, poi.type)) throw new BadRequestException('module_not_for_place');
    const drafts = settle(poi, now);
    let row = modules.find((m) => m.moduleType === type);
    if (!row?.offered && !planIncludes(effectivePlan(poi), type)) throw new BadRequestException('not_in_plan');
    if (row && isLive(row)) throw new ConflictException('Module already on');
    if (!row) {
      row = this.modules.create({ poi: { id: poiId }, moduleType: type, startDate: now });
      modules.push(row);
    }
    row.status = ModuleStatus.ACTIVE;
    await this.save(poi, modules, drafts);
    return this.summary(poiId);
  }

  /** Hides a module from the app; its content is kept. */
  async hide(poiId: string, type: ModuleType): Promise<BillingSummary> {
    const { poi, modules } = await this.load(poiId);
    const row = modules.find((m) => m.moduleType === type);
    if (!row || !isLive(row)) throw new ConflictException('Module already off');
    row.status = ModuleStatus.CANCELLED;
    await this.save(poi, modules, []);
    return this.summary(poiId);
  }

  /**
   * Superadmin: gives one module to a community (Seb, 17 Oct 2026),
   * whatever its plan. It is switched on now and is never paused.
   */
  async offer(poiId: string, type: ModuleType, now = new Date()): Promise<BillingSummary> {
    const { poi, modules } = await this.load(poiId);
    if (!moduleFitsPlace(type, poi.type)) throw new BadRequestException('module_not_for_place');
    const drafts = settle(poi, now);
    let row = modules.find((m) => m.moduleType === type);
    if (!row) {
      row = this.modules.create({ poi: { id: poiId }, moduleType: type, startDate: now });
      modules.push(row);
    }
    row.status = ModuleStatus.ACTIVE;
    row.offered = true;
    await this.save(poi, modules, drafts);
    return this.summary(poiId);
  }

  /** Superadmin: takes a module gift back; the plan decides again. */
  async unoffer(poiId: string, type: ModuleType): Promise<BillingSummary> {
    const { poi, modules } = await this.load(poiId);
    const row = modules.find((m) => m.moduleType === type);
    if (!row?.offered) throw new ConflictException('Module not offered');
    row.offered = false;
    await this.save(poi, modules, []);
    return this.summary(poiId);
  }

  /**
   * Superadmin: gives a plan, never billed (or takes the gift back, which
   * leaves the community on Basic).
   */
  async offerPlan(poiId: string, tier: PlanTier | null, now = new Date()): Promise<BillingSummary> {
    const { poi, modules } = await this.load(poiId);
    const drafts = settle(poi, now);
    if (tier) {
      poi.plan = tier;
      poi.planOffered = true;
      poi.planTrialEndsAt = null;
      poi.pendingPlan = null;
      poi.billingRenewsAt = null;
      this.addPlanModules(poi, modules);
    } else {
      if (!poi.planOffered) throw new ConflictException('Plan not offered');
      poi.planOffered = false;
      poi.plan = PlanTier.BASIC;
    }
    await this.save(poi, modules, drafts);
    return this.summary(poiId);
  }

  /**
   * Superadmin: one more free month. A running trial gets a month on its
   * end date; a community on Basic gets a month of `tier` from now.
   */
  async extendTrial(poiId: string, tier: PlanTier, now = new Date()): Promise<BillingSummary> {
    const { poi, modules } = await this.load(poiId);
    const drafts = settle(poi, now);
    if (poi.planTrialEndsAt) {
      poi.planTrialEndsAt = addMonths(poi.planTrialEndsAt, 1);
    } else if (poi.plan === PlanTier.BASIC && !poi.planOffered && !poi.billingComped) {
      poi.plan = tier === PlanTier.BASIC ? PlanTier.COMPLETE : tier;
      poi.planTrialUsed = true;
      poi.planTrialEndsAt = addMonths(now, 1);
      this.addPlanModules(poi, modules);
      await this.recordTrial(poi);
    } else {
      throw new ConflictException('Plan already paid or offered');
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
