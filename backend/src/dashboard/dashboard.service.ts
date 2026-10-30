import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, IsNull, LessThan, MoreThanOrEqual, Not, Repository } from 'typeorm';
import {
  ServiceRequest,
  ServiceRequestStatus,
  ServiceRequestType,
} from '../service-requests/entities/service-request.entity.js';
import { ServiceRequestMessage } from '../service-requests/entities/service-request-message.entity.js';
import { ServiceRequestDocument } from '../service-requests/entities/service-request-document.entity.js';
import { MassIntention, MassIntentionStatus } from '../mass-intentions/entities/mass-intention.entity.js';
import { PoiBadge } from '../poi-badges/entities/poi-badge.entity.js';
import { BadgeKind } from '../common/enums/badge-kind.enum.js';
import { UserPoi } from '../user-pois/entities/user-poi.entity.js';
import { PrayerRequest } from '../prayer-requests/entities/prayer-request.entity.js';
import { ActiveModule } from '../active-modules/entities/active-module.entity.js';
import { MemberRole } from '../common/enums/member-role.enum.js';
import { ModuleStatus } from '../common/enums/module-status.enum.js';
import { ModuleType } from '../common/enums/module-type.enum.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const OPEN_STATUSES = [
  ServiceRequestStatus.RECEIVED,
  ServiceRequestStatus.IN_PROGRESS,
  ServiceRequestStatus.APPOINTMENT_SET,
];

export type DashboardRequest = { id: string; type: ServiceRequestType; contactName: string; at: string };

export type DashboardDocument = {
  requestId: string;
  type: ServiceRequestType;
  contactName: string;
  label: string;
  receivedAt: string;
};

export type DashboardAppointment = DashboardRequest & { place: string | null };

// Intentions counted per celebration: the Mass they are read at.
export type DashboardCelebration = { at: string | null; title: string | null; count: number };

export type DashboardMessage = { id: string; text: string; showUntil: string };

/**
 * What the dashboard's first page shows: what is waiting on the office,
 * and the few numbers worth a glance. Donations and events already have
 * endpoints of their own the page reuses.
 */
export type DashboardSummary = {
  // Asked for from the app and never opened by the office.
  newRequests: DashboardRequest[];
  // Opened, but the member spoke last and the office has not answered.
  awaitingReply: DashboardRequest[];
  // Papers a member sent since the office last opened the request.
  documentsToCheck: DashboardDocument[];
  // Appointments set in requests, over the next seven days.
  appointments: DashboardAppointment[];
  // Intentions whose Mass is past and not yet ticked as said.
  intentionsToMark: DashboardCelebration[];
  // Intentions to read at the Masses of the next seven days.
  upcomingIntentions: DashboardCelebration[];
  // Home page messages still switched on after their last day.
  expiredMessages: DashboardMessage[];
  members: { total: number; newThisWeek: number };
  prayerRequestsThisWeek: number;
};

/** For the place switcher: how many things wait on the office there. */
export type PlaceWaiting = { poiId: string; waiting: number };

function iso(date: Date): string {
  return date.toISOString();
}

function byCelebration(rows: MassIntention[]): DashboardCelebration[] {
  const groups = new Map<string, DashboardCelebration>();
  for (const row of rows) {
    const at = row.celebrationAt ? iso(row.celebrationAt) : null;
    const key = `${at}|${row.celebrationTitle ?? ''}`;
    const group = groups.get(key) ?? { at, title: row.celebrationTitle ?? null, count: 0 };
    group.count += 1;
    groups.set(key, group);
  }
  return [...groups.values()];
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(ServiceRequest) private readonly requests: Repository<ServiceRequest>,
    @InjectRepository(ServiceRequestMessage) private readonly messages: Repository<ServiceRequestMessage>,
    @InjectRepository(ServiceRequestDocument) private readonly documents: Repository<ServiceRequestDocument>,
    @InjectRepository(MassIntention) private readonly intentions: Repository<MassIntention>,
    @InjectRepository(PoiBadge) private readonly badges: Repository<PoiBadge>,
    @InjectRepository(UserPoi) private readonly memberships: Repository<UserPoi>,
    @InjectRepository(PrayerRequest) private readonly prayers: Repository<PrayerRequest>,
    @InjectRepository(ActiveModule) private readonly modules: Repository<ActiveModule>,
  ) {}

  /**
   * Every place this admin runs, with what members are waiting on there:
   * requests to open or answer, papers to check, unread messages. Only for
   * modules the place has on, as on its dashboard.
   */
  async waitingByPlace(userId: string): Promise<PlaceWaiting[]> {
    const memberships = await this.memberships.find({
      where: { user: { id: userId }, role: MemberRole.ADMIN },
      relations: { poi: true },
    });
    const places = memberships.filter((m) => !m.poi.suspendedAt).map((m) => m.poi.id);
    if (places.length === 0) return [];
    const live = await this.modules.find({
      where: {
        poi: { id: In(places) },
        moduleType: In([ModuleType.REQUESTS, ModuleType.MESSAGES]),
        status: In([ModuleStatus.TRIAL, ModuleStatus.ACTIVE]),
      },
      relations: { poi: true },
    });
    const isLive = (poiId: string, type: ModuleType) =>
      live.some((m) => m.poi.id === poiId && m.moduleType === type);

    return Promise.all(
      places.map(async (poiId) => {
        let waiting = 0;
        if (isLive(poiId, ModuleType.REQUESTS)) {
          const summary = await this.summary(poiId);
          waiting += summary.newRequests.length + summary.awaitingReply.length + summary.documentsToCheck.length;
        }
        if (isLive(poiId, ModuleType.MESSAGES)) waiting += await this.unreadConversations(poiId);
        return { poiId, waiting };
      }),
    );
  }

  /** Conversations where a member wrote last, after the office last looked. */
  private async unreadConversations(poiId: string): Promise<number> {
    const rows: { n: string }[] = await this.memberships.query(
      `SELECT count(*) AS n
         FROM member_conversations c
         JOIN LATERAL (
           SELECT m.from_staff, m.created_at FROM member_messages m
            WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1
         ) last ON true
        WHERE c.poi_id = $1 AND NOT last.from_staff
          AND (c.staff_seen_at IS NULL OR last.created_at > c.staff_seen_at)`,
      [poiId],
    );
    return Number(rows[0]?.n ?? 0);
  }

  async summary(poiId: string, now = new Date()): Promise<DashboardSummary> {
    const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
    const weekAhead = new Date(now.getTime() + 7 * DAY_MS);

    const open = await this.requests.find({
      where: { poi: { id: poiId }, status: In(OPEN_STATUSES) },
      order: { createdAt: 'ASC' },
    });
    const summaryOf = (r: ServiceRequest, at: Date): DashboardRequest => ({
      id: r.id,
      type: r.type,
      contactName: r.contactName,
      at: iso(at),
    });

    // Nobody at the office has opened it or done anything with it yet.
    const isNew = (r: ServiceRequest) => !r.staffSeenAt && !r.lastStaffActivityAt;
    const newRequests = open.filter(isNew).map((r) => summaryOf(r, r.createdAt));

    const seen = open.filter((r) => !isNew(r));
    const lastWords = await this.lastMessages(seen.map((r) => r.id));
    const awaitingReply: DashboardRequest[] = [];
    for (const r of seen) {
      const last = lastWords.get(r.id);
      if (last && !last.fromStaff) awaitingReply.push(summaryOf(r, last.createdAt));
      // Opened and left as it came: nobody has written back or moved it on.
      else if (!last && r.status === ServiceRequestStatus.RECEIVED) awaitingReply.push(summaryOf(r, r.createdAt));
    }

    const openById = new Map(open.map((r) => [r.id, r]));
    const received = open.length
      ? await this.documents.find({
          where: { request: { id: In(open.map((r) => r.id)) }, filePath: Not(IsNull()), receivedAt: Not(IsNull()) },
          relations: { request: true },
          order: { receivedAt: 'ASC' },
        })
      : [];
    const documentsToCheck: DashboardDocument[] = [];
    for (const document of received) {
      const request = openById.get(document.request.id);
      if (!request || !document.receivedAt) continue;
      if (request.staffSeenAt && document.receivedAt <= request.staffSeenAt) continue;
      documentsToCheck.push({
        requestId: request.id,
        type: request.type,
        contactName: request.contactName,
        label: document.label,
        receivedAt: iso(document.receivedAt),
      });
    }

    const appointments = open
      .filter((r) => r.appointmentAt && r.appointmentAt >= now && r.appointmentAt <= weekAhead)
      .sort((a, b) => a.appointmentAt!.getTime() - b.appointmentAt!.getTime())
      .map((r) => ({ ...summaryOf(r, r.appointmentAt!), place: r.appointmentPlace ?? null }));

    const [past, upcoming] = await Promise.all([
      this.intentions.find({
        where: { poi: { id: poiId }, status: MassIntentionStatus.CONFIRMED, celebrationAt: LessThan(now) },
        order: { celebrationAt: 'DESC' },
      }),
      this.intentions.find({
        where: {
          poi: { id: poiId },
          status: MassIntentionStatus.CONFIRMED,
          celebrationAt: Between(now, weekAhead),
        },
        order: { celebrationAt: 'ASC' },
      }),
    ]);

    const today = iso(now).slice(0, 10);
    const expired = await this.badges.find({
      where: { poi: { id: poiId }, kind: BadgeKind.MESSAGE, enabled: true, showUntil: LessThan(today) },
      order: { position: 'ASC' },
    });

    const [total, newThisWeek, prayerRequestsThisWeek] = await Promise.all([
      this.memberships.count({ where: { poi: { id: poiId } } }),
      this.memberships.count({ where: { poi: { id: poiId }, joinedAt: MoreThanOrEqual(weekAgo) } }),
      this.prayers.count({ where: { poi: { id: poiId }, createdAt: MoreThanOrEqual(weekAgo) } }),
    ]);

    return {
      newRequests,
      awaitingReply,
      documentsToCheck,
      appointments,
      intentionsToMark: byCelebration(past),
      upcomingIntentions: byCelebration(upcoming),
      expiredMessages: expired.map((b) => ({ id: b.id, text: b.text ?? '', showUntil: b.showUntil! })),
      members: { total, newThisWeek },
      prayerRequestsThisWeek,
    };
  }

  /** The newest message of each request, if it has any. */
  private async lastMessages(requestIds: string[]): Promise<Map<string, { fromStaff: boolean; createdAt: Date }>> {
    const result = new Map<string, { fromStaff: boolean; createdAt: Date }>();
    if (requestIds.length === 0) return result;
    const rows = await this.messages
      .createQueryBuilder('m')
      .select(['m.request_id AS "requestId"', 'm.from_staff AS "fromStaff"', 'm.created_at AS "createdAt"'])
      .distinctOn(['m.request_id'])
      .where('m.request_id IN (:...ids)', { ids: requestIds })
      .orderBy('m.request_id')
      .addOrderBy('m.created_at', 'DESC')
      .getRawMany<{ requestId: string; fromStaff: boolean; createdAt: Date }>();
    for (const row of rows) result.set(row.requestId, { fromStaff: row.fromStaff, createdAt: new Date(row.createdAt) });
    return result;
  }
}
