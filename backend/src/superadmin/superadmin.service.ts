import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, In, LessThan, Repository } from 'typeorm';
import { randomInt, randomUUID } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import type { Request } from 'express';
import { Poi } from '../pois/entities/poi.entity.js';
import { User } from '../users/entities/user.entity.js';
import { UserPoi } from '../user-pois/entities/user-poi.entity.js';
import { ActiveModule } from '../active-modules/entities/active-module.entity.js';
import { BillingInvoice } from '../active-modules/entities/billing-invoice.entity.js';
import { PushToken } from '../notifications/entities/push-token.entity.js';
import { AuditLog } from './entities/audit-log.entity.js';
import { ModuleBillingService } from '../active-modules/module-billing.service.js';
import { MemberRole } from '../common/enums/member-role.enum.js';
import { ModuleType } from '../common/enums/module-type.enum.js';
import { ModuleStatus } from '../common/enums/module-status.enum.js';
import { effectivePlan, isPaying, monthlyEquivalent } from '../active-modules/billing-rules.js';
import { PlanTier } from '../common/enums/plan-tier.enum.js';
import { moduleFitsPlace, modulesForPlace } from '../active-modules/module-places.js';
import { SuperadminAccess, type SuperadminIdentity } from '../auth/superadmin-access.service.js';
import { ErrorTracker } from './error-tracker.js';
import type { CreateCommunityDto, UpdateCommunityDto } from './dto/superadmin.dto.js';
import { RegistrationsService } from '../registrations/registrations.service.js';
import type { ApproveRegistrationDto } from '../registrations/dto/registration.dto.js';

const DAY = 24 * 60 * 60 * 1000;
const LIVE = [ModuleStatus.TRIAL, ModuleStatus.ACTIVE];
const bootedAt = new Date();

function monthStart(date: Date, offset = 0): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1));
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * A password a person can read out over the phone: no 0/O, 1/l/I.
 * 15 characters from 54 is about 86 bits.
 */
export function temporaryPassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const groups: string[] = [];
  for (let g = 0; g < 3; g++) {
    let group = '';
    for (let i = 0; i < 5; i++) group += alphabet[randomInt(alphabet.length)];
    groups.push(group);
  }
  return groups.join('-');
}

type Actor = { identity: SuperadminIdentity; request: Request };

/**
 * Everything the superadmin section reads and changes (Seb, 17 Oct 2026):
 * the whole app's figures, every community, every account. Every change
 * goes in the Journal with who, when and from where.
 */
export type WatchItem = {
  level: 'warn' | 'alert' | 'ok';
  kind: 'trialEnding' | 'requestsWaiting' | 'adminQuiet' | 'suspended' | 'demoLogin' | 'errors' | 'ok';
  poiId?: string;
  poiName?: string;
  module?: string;
  plan?: PlanTier;
  n?: number;
  days?: number;
  date?: string;
  never?: boolean;
};

@Injectable()
export class SuperadminService {
  constructor(
    private readonly data: DataSource,
    private readonly config: ConfigService,
    private readonly access: SuperadminAccess,
    private readonly billing: ModuleBillingService,
    private readonly errors: ErrorTracker,
    @InjectRepository(Poi) private readonly pois: Repository<Poi>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(UserPoi) private readonly memberships: Repository<UserPoi>,
    @InjectRepository(ActiveModule) private readonly modules: Repository<ActiveModule>,
    @InjectRepository(BillingInvoice) private readonly invoices: Repository<BillingInvoice>,
    @InjectRepository(PushToken) private readonly pushTokens: Repository<PushToken>,
    @InjectRepository(AuditLog) private readonly audit: Repository<AuditLog>,
    private readonly registrations: RegistrationsService,
  ) {}

  private log(actor: Actor, action: string, poi?: Pick<Poi, 'id' | 'name'> | null, details: Record<string, unknown> = {}) {
    return this.access.record({
      action: `superadmin.${action}`,
      actorId: actor.identity.userId,
      actorEmail: actor.identity.email,
      poiId: poi?.id ?? null,
      poiName: poi?.name ?? null,
      details,
      request: actor.request,
    });
  }

  private async findPoi(poiId: string): Promise<Poi> {
    const poi = await this.pois.findOne({ where: { id: poiId } });
    if (!poi) throw new NotFoundException('Unknown community');
    return poi;
  }

  /** Lazily settled billing, brought up to date for every community. */
  private async settleAll(): Promise<void> {
    const all = await this.pois.find({ select: { id: true } });
    for (const poi of all) await this.billing.settle(poi.id);
  }

  // ---------------------------------------------------------------- overview

  async overview() {
    await this.settleAll();
    const now = new Date();
    const thisMonth = monthStart(now);
    const lastMonth = monthStart(now, -1);
    const firstMonth = monthStart(now, -11);

    const revenueRows: { month: Date; total: string }[] = await this.data.query(
      `SELECT date_trunc('month', issued_at AT TIME ZONE 'UTC') AS month, SUM(amount) AS total
         FROM billing_invoices WHERE issued_at >= $1 GROUP BY 1`,
      [firstMonth],
    );
    const revenueByMonth = Array.from({ length: 12 }, (_, i) => {
      const start = monthStart(now, i - 11);
      const row = revenueRows.find((r) => new Date(r.month).getTime() === start.getTime());
      return { month: start.toISOString().slice(0, 7), total: money(Number(row?.total ?? 0)) };
    });
    const revenueThisMonth = revenueByMonth[11].total;
    const revenueLastMonth = revenueByMonth[10].total;

    const pois = await this.pois.find();
    const modules = await this.modules.find({ relations: { poi: true } });
    const live = modules.filter((m) => LIVE.includes(m.status) && moduleFitsPlace(m.moduleType, m.poi.type));
    let monthlyRecurring = 0;
    let trialPotential = 0;
    const paying = pois.filter((poi) => isPaying(poi));
    const trials = pois.filter((poi) => !poi.billingComped && !poi.planOffered && poi.planTrialEndsAt);
    for (const poi of paying) {
      // A smaller plan chosen for later is what will recur.
      monthlyRecurring += monthlyEquivalent(poi.pendingPlan ?? poi.plan, poi.billingInterval);
    }
    for (const poi of trials) trialPotential += monthlyEquivalent(poi.plan, poi.billingInterval);
    const offeredModules = live.filter((m) => m.offered).length;

    const [members] = await this.data.query(
      `SELECT COUNT(DISTINCT user_id)::int AS total,
              COUNT(*) FILTER (WHERE joined_at >= $1)::int AS new_this_month
         FROM user_pois WHERE role = 'member'`,
      [thisMonth],
    );
    const [active] = await this.data.query(
      `SELECT COUNT(*)::int AS total FROM users u
        WHERE u.last_seen_at >= $1 AND EXISTS (SELECT 1 FROM user_pois m WHERE m.user_id = u.id)`,
      [new Date(now.getTime() - 30 * DAY)],
    );
    const [gifts] = await this.data.query(
      `SELECT COALESCE(SUM(amount), 0) AS total, COALESCE(SUM(platform_fee), 0) AS fee, COUNT(*)::int AS count
         FROM donations WHERE status = 'completed' AND created_at >= $1`,
      [thisMonth],
    );
    const [requests] = await this.data.query(
      `SELECT COUNT(*)::int AS open,
              COUNT(*) FILTER (WHERE status = 'received' AND created_at < $1)::int AS waiting
         FROM service_requests WHERE status IN ('received', 'in_progress', 'appointment_set')`,
      [new Date(now.getTime() - 7 * DAY)],
    );

    return {
      generatedAt: now.toISOString(),
      environment: this.environment(),
      revenue: {
        thisMonth: revenueThisMonth,
        lastMonth: revenueLastMonth,
        byMonth: revenueByMonth,
        monthlyRecurring: money(monthlyRecurring),
        paidPlans: paying.length,
        trialPlans: trials.length,
        trialPotential: money(trialPotential),
        offeredPlans: pois.filter((p) => p.planOffered).length,
        offeredModules,
        // Nothing is charged yet (no payment provider): what would be.
        demo: true,
      },
      communities: {
        total: pois.length,
        comped: pois.filter((p) => p.billingComped || p.planOffered).length,
        paying: paying.length,
        suspended: pois.filter((p) => p.suspendedAt).length,
        newThisMonth: pois.filter((p) => p.createdAt >= thisMonth).length,
      },
      members: {
        total: members.total as number,
        newThisMonth: members.new_this_month as number,
        active30Days: active.total as number,
      },
      // fee: infunion's share of those gifts (donations/platform-fee.ts).
      donations: { thisMonth: money(Number(gifts.total)), fee: money(Number(gifts.fee)), count: gifts.count as number },
      requests: { open: requests.open as number, waitingOverAWeek: requests.waiting as number },
      lastMonthStart: lastMonth.toISOString(),
      watch: await this.watchList(now, pois, live),
    };
  }

  private async watchList(now: Date, pois: Poi[], live: ActiveModule[]) {
    // Kinds and figures only: the admin words them in Seb's chosen language.
    const items: WatchItem[] = [];
    const soon = new Date(now.getTime() + 7 * DAY);
    for (const poi of pois) {
      const ends = poi.planTrialEndsAt;
      if (!ends || ends > soon || poi.billingComped || poi.planOffered || poi.paymentMethodLabel) continue;
      const days = Math.max(0, Math.ceil((ends.getTime() - now.getTime()) / DAY));
      items.push({ level: 'warn', kind: 'trialEnding', poiId: poi.id, poiName: poi.name, plan: poi.plan, days });
    }
    const waiting: { poi_id: string; name: string; count: number; oldest: Date }[] = await this.data.query(
      `SELECT r.poi_id, p.name, COUNT(*)::int AS count, MIN(r.created_at) AS oldest
         FROM service_requests r JOIN pois p ON p.id = r.poi_id
        WHERE r.status = 'received' AND r.created_at < $1
        GROUP BY r.poi_id, p.name`,
      [new Date(now.getTime() - 7 * DAY)],
    );
    for (const row of waiting) {
      const days = Math.floor((now.getTime() - new Date(row.oldest).getTime()) / DAY);
      items.push({ level: 'alert', kind: 'requestsWaiting', poiId: row.poi_id, poiName: row.name, n: row.count, days });
    }
    const quiet: { id: string; name: string; last: Date | null }[] = await this.data.query(
      `SELECT p.id, p.name, MAX(u.last_login_at) AS last
         FROM pois p
         LEFT JOIN user_pois m ON m.poi_id = p.id AND m.role = 'admin'
         LEFT JOIN users u ON u.id = m.user_id
        WHERE p.suspended_at IS NULL
        GROUP BY p.id, p.name
       HAVING MAX(u.last_login_at) IS NULL OR MAX(u.last_login_at) < $1`,
      [new Date(now.getTime() - 30 * DAY)],
    );
    for (const row of quiet) {
      items.push({ level: 'warn', kind: 'adminQuiet', poiId: row.id, poiName: row.name, never: !row.last });
    }
    for (const poi of pois.filter((p) => p.suspendedAt)) {
      items.push({ level: 'warn', kind: 'suspended', poiId: poi.id, poiName: poi.name, date: poi.suspendedAt!.toISOString() });
    }
    if (this.demoLoginOn() && this.isProduction()) {
      items.push({ level: 'alert', kind: 'demoLogin' });
    }
    const errors = this.errors.countSince(new Date(now.getTime() - DAY));
    items.push(
      errors
        ? { level: 'alert', kind: 'errors', n: errors }
        : { level: 'ok', kind: 'ok', date: bootedAt.toISOString() },
    );
    return items;
  }

  // ------------------------------------------------------------- communities

  async listCommunities() {
    const pois = await this.pois.find({ order: { name: 'ASC' } });
    if (!pois.length) return [];
    await this.settleAll();
    const ids = pois.map((p) => p.id);
    const counts: { poi_id: string; members: number; admins: number; last_login: Date | null }[] = await this.data.query(
      `SELECT m.poi_id,
              COUNT(*) FILTER (WHERE m.role = 'member')::int AS members,
              COUNT(*) FILTER (WHERE m.role = 'admin')::int AS admins,
              MAX(u.last_login_at) FILTER (WHERE m.role = 'admin') AS last_login
         FROM user_pois m JOIN users u ON u.id = m.user_id
        WHERE m.poi_id = ANY($1) GROUP BY m.poi_id`,
      [ids],
    );
    const modules = await this.modules.find({ where: { poi: { id: In(ids) } }, relations: { poi: true } });
    return pois.map((poi) => {
      const row = counts.find((c) => c.poi_id === poi.id);
      const mine = modules.filter((m) => m.poi.id === poi.id && LIVE.includes(m.status) && moduleFitsPlace(m.moduleType, poi.type));
      const billing = poi.suspendedAt
        ? 'suspended'
        : poi.billingComped
          ? 'comped'
          : poi.planOffered
            ? 'offered'
            : poi.planTrialEndsAt
              ? 'trial'
              : isPaying(poi)
                ? 'paying'
                : 'free';
      return {
        id: poi.id,
        name: poi.name,
        city: poi.city ?? null,
        postalCode: poi.postalCode ?? null,
        language: poi.language,
        createdAt: poi.createdAt,
        suspendedAt: poi.suspendedAt ?? null,
        billing,
        members: row?.members ?? 0,
        admins: row?.admins ?? 0,
        lastAdminLoginAt: row?.last_login ?? null,
        liveModules: mine.length,
        totalModules: modulesForPlace(poi.type).length,
        plan: effectivePlan(poi),
        offeredModules: mine.filter((m) => m.offered).length,
        nextTrialEnd: poi.planTrialEndsAt ?? null,
        monthly: money(isPaying(poi) ? monthlyEquivalent(poi.plan, poi.billingInterval) : 0),
      };
    });
  }

  async community(poiId: string) {
    const poi = await this.findPoi(poiId);
    const billing = await this.billing.summary(poiId);
    const admins = await this.memberships.find({
      where: { poi: { id: poiId }, role: MemberRole.ADMIN },
      relations: { user: true },
    });
    const memberCount = await this.memberships.count({ where: { poi: { id: poiId }, role: MemberRole.MEMBER } });
    const elsewhere = await this.adminPlaces(admins.map((m) => m.user.id));
    return {
      poi: {
        id: poi.id,
        name: poi.name,
        type: poi.type,
        language: poi.language,
        address: poi.address ?? null,
        city: poi.city ?? null,
        postalCode: poi.postalCode ?? null,
        qrCodeToken: poi.qrCodeToken,
        createdAt: poi.createdAt,
        suspendedAt: poi.suspendedAt ?? null,
      },
      memberCount,
      admins: admins.map((m) => ({
        id: m.user.id,
        email: m.user.email ?? null,
        firstName: m.user.firstName ?? null,
        lastName: m.user.lastName ?? null,
        lastLoginAt: m.user.lastLoginAt ?? null,
        // The other places this person runs (one priest, three churches).
        otherPlaces: (elsewhere.get(m.user.id) ?? []).filter((p) => p.id !== poiId),
      })),
      billing,
      allModules: modulesForPlace(poi.type),
    };
  }

  async createCommunity(actor: Actor, dto: CreateCommunityDto) {
    const { adminEmail, adminFirstName, offeredPlan, ...fields } = dto;
    const poi = await this.pois.save(
      this.pois.create({ ...fields, name: fields.name.trim(), qrCodeToken: randomUUID() }),
    );
    // Basic's modules (Événements, Dons, Annonces) are free and on from the start.
    await this.billing.switchOnPlanModules(poi.id);
    if (offeredPlan && offeredPlan !== PlanTier.BASIC) await this.billing.offerPlan(poi.id, offeredPlan);
    const admin = await this.grantAdmin(poi, adminEmail, adminFirstName);
    await this.log(actor, 'poi.create', poi, { adminEmail: admin.email, offeredPlan: offeredPlan ?? null });
    return { poi: { id: poi.id, name: poi.name }, admin };
  }

  async updateCommunity(actor: Actor, poiId: string, dto: UpdateCommunityDto) {
    const poi = await this.findPoi(poiId);
    const changed = Object.keys(dto).filter((key) => (dto as Record<string, unknown>)[key] !== undefined);
    if (dto.name !== undefined) dto.name = dto.name.trim();
    Object.assign(poi, dto);
    await this.pois.save(poi);
    await this.log(actor, 'poi.update', poi, { fields: changed });
    return this.community(poiId);
  }

  async setSuspended(actor: Actor, poiId: string, suspended: boolean) {
    const poi = await this.findPoi(poiId);
    poi.suspendedAt = suspended ? new Date() : null;
    await this.pois.save(poi);
    await this.log(actor, suspended ? 'poi.suspend' : 'poi.unsuspend', poi);
    return this.community(poiId);
  }

  async deleteCommunity(actor: Actor, poiId: string, confirmName: string) {
    const poi = await this.findPoi(poiId);
    if (confirmName.trim() !== poi.name.trim()) throw new BadRequestException('name_mismatch');
    const members = await this.memberships.count({ where: { poi: { id: poiId } } });
    await this.pois.remove(poi);
    await this.log(actor, 'poi.delete', { id: poiId, name: poi.name }, { memberships: members });
  }

  async moduleAction(actor: Actor, poiId: string, type: ModuleType, action: 'start' | 'stop' | 'offer' | 'unoffer') {
    const poi = await this.findPoi(poiId);
    if (action === 'start') await this.billing.show(poiId, type);
    else if (action === 'stop') await this.billing.hide(poiId, type);
    else if (action === 'offer') await this.billing.offer(poiId, type);
    else await this.billing.unoffer(poiId, type);
    await this.log(actor, `module.${action}`, poi, { module: type });
    return this.community(poiId);
  }

  async planAction(actor: Actor, poiId: string, action: 'offer' | 'unoffer' | 'extend-trial', tier?: PlanTier) {
    const poi = await this.findPoi(poiId);
    if (action === 'offer') await this.billing.offerPlan(poiId, tier ?? PlanTier.COMPLETE);
    else if (action === 'unoffer') await this.billing.offerPlan(poiId, null);
    else await this.billing.extendTrial(poiId, tier ?? PlanTier.COMPLETE);
    await this.log(actor, `plan.${action}`, poi, { plan: tier ?? null });
    return this.community(poiId);
  }

  // ------------------------------------------------------------------ registrations

  /**
   * Approve on a request from the landing (Seb, 30 Oct 2026): creates the
   * place exactly as "Add community" does (or links the person to the
   * place they asked to manage), starts the free month of the plan they
   * chose, and tells them. Only once the document was checked.
   */
  async approveRegistration(actor: Actor, id: string, dto: ApproveRegistrationDto) {
    const r = await this.registrations.findOpen(id);
    if (!r.documentCheckedAt) throw new BadRequestException('document_not_checked');
    let poi: Poi;
    let admin: { userId: string; email: string; temporaryPassword: string | null };
    if (r.existingPoiId) {
      poi = await this.findPoi(r.existingPoiId);
      admin = await this.grantAdmin(poi, r.email, r.firstName);
      await this.log(actor, 'admin.add', poi, { email: admin.email, newAccount: !!admin.temporaryPassword, registration: r.id });
    } else {
      const paid = RegistrationsService.paidPlan(r);
      const created = await this.createCommunity(actor, {
        name: r.placeName,
        type: dto.type ?? r.type,
        language: r.language,
        address: r.address,
        city: r.city,
        postalCode: r.postalCode,
        offeredPlan: dto.offerPlan && paid ? paid : undefined,
        adminEmail: r.email,
        adminFirstName: r.firstName,
      });
      admin = created.admin;
      poi = await this.findPoi(created.poi.id);
      poi.legalName = r.legalName;
      poi.legalTaxId = r.taxId;
      poi.legalAddress = `${r.address}, ${r.postalCode} ${r.city}`;
      poi.legalPhone = r.phone ?? null;
      poi.billingInterval = r.billingInterval;
      await this.pois.save(poi);
      if (paid && !dto.offerPlan) await this.billing.startTrial(poi.id, paid);
    }
    const user = await this.users.findOne({ where: { id: admin.userId } });
    if (user && !user.lastName) await this.users.update(user.id, { lastName: r.lastName });
    await this.registrations.markApproved(r, poi.id, actor.identity.email, admin.temporaryPassword);
    await this.log(actor, 'registration.approve', poi, { email: r.email, plan: r.plan, claim: !!r.existingPoiId });
    return {
      registration: await this.registrations.detail(id),
      admin,
      emailsDelivered: this.registrations.emailsDelivered,
    };
  }

  async registrationDocumentChecked(actor: Actor, id: string, checked: boolean) {
    const r = await this.registrations.markDocumentChecked(id, checked);
    await this.log(actor, checked ? 'registration.documentChecked' : 'registration.documentUnchecked', null, { place: r.placeName, email: r.email });
    return this.registrations.detail(id);
  }

  async questionRegistration(actor: Actor, id: string, message: string) {
    const r = await this.registrations.askQuestion(id, message);
    await this.log(actor, 'registration.question', null, { place: r.placeName, email: r.email });
    return this.registrations.detail(id);
  }

  async declineRegistration(actor: Actor, id: string, reason: string, block: boolean) {
    const r = await this.registrations.decline(id, reason, block, actor.identity.email);
    await this.log(actor, block ? 'registration.block' : 'registration.decline', null, { place: r.placeName, email: r.email, taxId: block ? r.taxId : undefined });
    return this.registrations.detail(id);
  }

  // ------------------------------------------------------------------ admins

  /**
   * Makes `email` an admin of `poi`, creating the account if needed. The
   * temporary password is returned once, here, and never stored in clear.
   */
  /** Every place each of these people is admin of, by person. */
  private async adminPlaces(userIds: string[]): Promise<Map<string, { id: string; name: string }[]>> {
    const byUser = new Map<string, { id: string; name: string }[]>();
    if (userIds.length === 0) return byUser;
    const rows = await this.memberships.find({
      where: { user: { id: In(userIds) }, role: MemberRole.ADMIN },
      relations: { user: true, poi: true },
    });
    for (const row of rows) {
      const list = byUser.get(row.user.id) ?? [];
      list.push({ id: row.poi.id, name: row.poi.name });
      byUser.set(row.user.id, list);
    }
    for (const list of byUser.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return byUser;
  }

  private findByEmail(rawEmail: string): Promise<User | null> {
    const email = rawEmail.trim().toLowerCase();
    return this.users.createQueryBuilder('u').where('lower(u.email) = :email', { email }).getOne();
  }

  /**
   * Before "Add admin": is this email already someone, and which places do
   * they run? Lets the superadmin see they keep their password.
   */
  async adminLookup(rawEmail: string) {
    const user = rawEmail.includes('@') ? await this.findByEmail(rawEmail) : null;
    if (!user || user.isSuperadmin) return { exists: false as const };
    const places = (await this.adminPlaces([user.id])).get(user.id) ?? [];
    return {
      exists: true as const,
      userId: user.id,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      places,
    };
  }

  private async grantAdmin(poi: Poi, rawEmail: string, firstName?: string) {
    const email = rawEmail.trim().toLowerCase();
    const user = await this.findByEmail(email);
    if (!user) {
      const password = temporaryPassword();
      const created = await this.users.save(
        this.users.create({ email, firstName: firstName?.trim() || undefined, passwordHash: await bcrypt.hash(password, 12) }),
      );
      return this.linkAdmin(poi, created, password);
    }
    return this.linkAdmin(poi, user, null);
  }

  /**
   * Makes an account admin of one more place. An account that never had a
   * password (it only ever signed in to the app) gets a temporary one, or
   * it couldn't open the admin.
   */
  private async linkAdmin(poi: Poi, user: User, newPassword: string | null) {
    if (user.isSuperadmin) throw new BadRequestException('superadmin_cannot_be_admin');
    const existing = await this.memberships.findOne({ where: { user: { id: user.id }, poi: { id: poi.id } } });
    if (existing) {
      if (existing.role === MemberRole.ADMIN) throw new ConflictException('already_admin');
      existing.role = MemberRole.ADMIN;
      await this.memberships.save(existing);
    } else {
      await this.memberships.save(this.memberships.create({ user: { id: user.id }, poi: { id: poi.id }, role: MemberRole.ADMIN }));
    }
    let password = newPassword;
    // password_hash is never loaded by default: ask for it here.
    const withHash = password
      ? null
      : await this.users.createQueryBuilder('u').addSelect('u.passwordHash').where('u.id = :id', { id: user.id }).getOne();
    if (withHash && !withHash.passwordHash) {
      password = temporaryPassword();
      await this.users.update(user.id, { passwordHash: await bcrypt.hash(password, 12) });
    }
    return { userId: user.id, email: user.email ?? '', temporaryPassword: password };
  }

  async addAdmin(actor: Actor, poiId: string, email: string, firstName?: string) {
    const poi = await this.findPoi(poiId);
    const admin = await this.grantAdmin(poi, email, firstName);
    await this.log(actor, 'admin.add', poi, { email: admin.email, newAccount: !!admin.temporaryPassword });
    return { admin, community: await this.community(poiId) };
  }

  private async adminMembership(poiId: string, userId: string) {
    const membership = await this.memberships.findOne({
      where: { poi: { id: poiId }, user: { id: userId }, role: MemberRole.ADMIN },
      relations: { user: true, poi: true },
    });
    if (!membership) throw new NotFoundException('Not an admin of this community');
    return membership;
  }

  async removeAdmin(actor: Actor, poiId: string, userId: string) {
    const membership = await this.adminMembership(poiId, userId);
    await this.memberships.remove(membership);
    await this.log(actor, 'admin.remove', membership.poi, { email: membership.user.email });
    return this.community(poiId);
  }

  /** From a person's account page: one more place they run. */
  async addPlaceToUser(actor: Actor, userId: string, poiId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Unknown account');
    // The admin signs in with an email and a password.
    if (!user.email) throw new BadRequestException('admin_needs_email');
    const poi = await this.findPoi(poiId);
    const admin = await this.linkAdmin(poi, user, null);
    await this.log(actor, 'admin.add', poi, { email: admin.email, newAccount: false, fromAccount: true });
    return { admin, account: await this.describeUser(user) };
  }

  async removePlaceFromUser(actor: Actor, userId: string, poiId: string) {
    await this.removeAdmin(actor, poiId, userId);
    return this.user(userId);
  }

  async resetAdminPassword(actor: Actor, poiId: string, userId: string) {
    const membership = await this.adminMembership(poiId, userId);
    if (membership.user.isSuperadmin) throw new BadRequestException('Not allowed');
    const password = temporaryPassword();
    await this.users.update(userId, { passwordHash: await bcrypt.hash(password, 12) });
    await this.log(actor, 'admin.password_reset', membership.poi, { email: membership.user.email });
    return { email: membership.user.email, temporaryPassword: password };
  }

  // ------------------------------------------------------------------- users

  async searchUsers(query: string) {
    const q = query.trim();
    if (q.length < 2) return [];
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const users = await this.users.find({
      where: [{ email: ILike(like) }, { phone: ILike(like) }, { firstName: ILike(like) }, { lastName: ILike(like) }],
      order: { createdAt: 'DESC' },
      take: 50,
    });
    return Promise.all(users.map((user) => this.describeUser(user)));
  }

  async user(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Unknown account');
    return this.describeUser(user);
  }

  private async describeUser(user: User) {
    const memberships = await this.memberships.find({ where: { user: { id: user.id } }, relations: { poi: true } });
    return {
      id: user.id,
      email: user.email ?? null,
      phone: user.phone ?? null,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      language: user.language,
      createdAt: user.createdAt,
      lastSeenAt: user.lastSeenAt ?? null,
      lastLoginAt: user.lastLoginAt ?? null,
      isSuperadmin: user.isSuperadmin,
      communities: memberships.map((m) => ({ id: m.poi.id, name: m.poi.name, role: m.role, joinedAt: m.joinedAt })),
    };
  }

  /** On request (GDPR): the account and what is only theirs goes. */
  async deleteUser(actor: Actor, userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Unknown account');
    if (user.isSuperadmin || user.id === actor.identity.userId) throw new BadRequestException('Not allowed');
    await this.users.remove(user);
    await this.log(actor, 'user.delete', null, { userId, name: [user.firstName, user.lastName].filter(Boolean).join(' ') || null });
  }

  // ------------------------------------------------------------------ health

  private isProduction(): boolean {
    return this.config.get<string>('NODE_ENV', 'development') === 'production';
  }

  private demoLoginOn(): boolean {
    // Mirrors PhoneAuthService.demoLoginEnabled with no SMS sender wired.
    return (
      this.config.get<string>('DEMO_LOGIN') !== 'off' &&
      (!this.isProduction() || this.config.get<string>('DEMO_LOGIN') === 'on')
    );
  }

  private environment(): string {
    return this.config.get<string>('RAILWAY_ENVIRONMENT_NAME') || this.config.get<string>('NODE_ENV', 'development');
  }

  async health() {
    const started = Date.now();
    await this.data.query('SELECT 1');
    const dbLatencyMs = Date.now() - started;
    const [size] = await this.data.query('SELECT pg_database_size(current_database())::bigint AS bytes');
    const now = new Date();
    // Codes, worded by the admin.
    const warnings: ('demoLogin' | 'initialPassword' | 'reset2fa' | 'cors')[] = [];
    if (this.demoLoginOn() && this.isProduction()) warnings.push('demoLogin');
    if (this.config.get<string>('SUPERADMIN_INITIAL_PASSWORD')) {
      warnings.push('initialPassword');
    }
    if (this.config.get<string>('SUPERADMIN_RESET_2FA')) warnings.push('reset2fa');
    if (this.isProduction() && !this.config.get<string>('CORS_ORIGINS')) warnings.push('cors');
    return {
      environment: this.environment(),
      nodeEnv: this.config.get<string>('NODE_ENV', 'development'),
      version: (this.config.get<string>('RAILWAY_GIT_COMMIT_SHA') ?? '').slice(0, 7) || null,
      branch: this.config.get<string>('RAILWAY_GIT_BRANCH') ?? null,
      startedAt: bootedAt.toISOString(),
      uptimeSeconds: Math.round((now.getTime() - bootedAt.getTime()) / 1000),
      memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      database: { ok: true, latencyMs: dbLatencyMs, sizeMb: Math.round(Number(size.bytes) / 1024 / 1024) },
      errors24h: this.errors.countSince(new Date(now.getTime() - DAY)),
      recentErrors: this.errors.recent(20),
      push: {
        enabled: this.config.get<string>('PUSH_NOTIFICATIONS', 'on') !== 'off',
        devices: await this.pushTokens.count(),
      },
      demoLogin: this.demoLoginOn(),
      stripe: !!this.config.get<string>('STRIPE_SECRET_KEY'),
      warnings,
    };
  }

  // ------------------------------------------------------------------- audit

  journal(before?: string, action?: string) {
    const where: Record<string, unknown> = {};
    if (before) {
      const date = new Date(before);
      if (Number.isNaN(date.getTime())) throw new BadRequestException('Bad date');
      where.createdAt = LessThan(date);
    }
    if (action) where.action = ILike(`${action.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    return this.audit.find({ where, order: { createdAt: 'DESC' }, take: 100 });
  }
}
