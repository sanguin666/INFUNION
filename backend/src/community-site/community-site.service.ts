import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Poi } from '../pois/entities/poi.entity.js';
import { Event } from '../events/entities/event.entity.js';
import { EventCategory, EventRecurrence } from '../events/entities/event-kinds.js';
import { isTimeZone, localTime, startsBetween } from '../events/occurrences.js';
import { ModuleType } from '../common/enums/module-type.enum.js';
import { PoiType } from '../common/enums/poi-type.enum.js';
import { PageBlockType } from '../common/enums/page-block-type.enum.js';

/** The parts of the website a team can leave out. */
export const SITE_PARTS = ['home', 'badges', 'timetable', 'events', 'news', 'campaign', 'map'] as const;
export type SitePart = (typeof SITE_PARTS)[number];

const RESERVED = new Set(['admin', 'api', 'app', 'www', 'infunion', 'help', 'support', 'login', 'join', 'new', 'c']);
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

const DAY_MS = 24 * 60 * 60 * 1000;
const LIVE_STATUSES = new Set(['trial', 'active']);

export type SiteSettings = { slug: string; published: boolean; hidden: SitePart[]; url: string };

export type SiteSlot = { start: Date; end: Date | null; title: string; category: string };
export type SiteData = {
  poi: Poi;
  timeZone: string;
  now: Date;
  hidden: Set<SitePart>;
  blocks: { type: string; title: string | null; body: string | null; imageUrl: string | null }[];
  messages: { text: string; important: boolean }[];
  week: SiteSlot[];
  upcoming: { title: string; start: Date; location: string | null }[];
  nextMass: Date | null;
  open: { now: true; until: Date | null } | { now: false; next: Date | null } | null;
  news: { title: string; body: string | null; imageUrl: string | null; important: boolean; createdAt: Date }[];
  campaign: { title: string; description: string | null; goal: number | null; raised: number; imageUrl: string | null } | null;
  currency: string;
};

/**
 * A small public website for each community (Seb, 9 Nov 2026, #195), built
 * from what the team already keeps up to date. It shows the community as
 * its own and sends people to the app to join.
 */
@Injectable()
export class CommunitySiteService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  private get timeZone(): string {
    const configured = this.config.get<string>('DEFAULT_TIME_ZONE');
    return isTimeZone(configured) ? configured : 'Europe/Madrid';
  }

  /** Where the sites live: SITE_URL, else the address the request came in on. */
  baseUrl(requestBase: string): string {
    return (this.config.get<string>('SITE_URL') ?? requestBase).replace(/\/+$/, '');
  }

  private async poi(poiId: string): Promise<Poi> {
    const poi = await this.dataSource.getRepository(Poi).findOne({ where: { id: poiId } });
    if (!poi) throw new NotFoundException('Unknown community');
    return poi;
  }

  async settings(poiId: string, requestBase: string): Promise<SiteSettings> {
    const poi = await this.poi(poiId);
    if (!poi.siteSlug) {
      poi.siteSlug = await this.freeSlug(poi);
      await this.dataSource.getRepository(Poi).update({ id: poi.id }, { siteSlug: poi.siteSlug });
    }
    return this.view(poi, requestBase);
  }

  async update(
    poiId: string,
    patch: { slug?: string; published?: boolean; hidden?: string[] },
    requestBase: string,
  ): Promise<SiteSettings> {
    const poi = await this.poi(poiId);
    const changes: Partial<Poi> = {};
    if (patch.slug !== undefined) {
      const slug = patch.slug.trim().toLowerCase();
      if (!SLUG_PATTERN.test(slug) || RESERVED.has(slug)) throw new BadRequestException('slug_invalid');
      const taken = await this.dataSource.getRepository(Poi).findOne({ where: { siteSlug: slug } });
      if (taken && taken.id !== poi.id) throw new ConflictException('slug_taken');
      changes.siteSlug = slug;
    }
    if (patch.published !== undefined) changes.sitePublished = patch.published;
    if (patch.hidden !== undefined) {
      changes.siteHidden = [...new Set(patch.hidden)].filter((part): part is SitePart =>
        (SITE_PARTS as readonly string[]).includes(part),
      );
    }
    if (changes.sitePublished && !(changes.siteSlug ?? poi.siteSlug)) changes.siteSlug = await this.freeSlug(poi);
    await this.dataSource.getRepository(Poi).update({ id: poi.id }, changes);
    return this.view({ ...poi, ...changes } as Poi, requestBase);
  }

  private view(poi: Poi, requestBase: string): SiteSettings {
    return {
      slug: poi.siteSlug ?? '',
      published: poi.sitePublished,
      hidden: (poi.siteHidden ?? []) as SitePart[],
      url: `${this.baseUrl(requestBase)}/c/${poi.siteSlug ?? ''}`,
    };
  }

  /** "Nuestra Señora del Carmen" → "nuestra-senora-del-carmen", made unique. */
  private async freeSlug(poi: Poi): Promise<string> {
    let base = poi.name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 34)
      .replace(/-+$/g, '');
    if (base.length < 3 || RESERVED.has(base)) base = `community-${poi.id.slice(0, 6)}`;
    const repo = this.dataSource.getRepository(Poi);
    for (let n = 1; n < 50; n++) {
      const slug = n === 1 ? base : `${base}-${n}`;
      const taken = await repo.findOne({ where: { siteSlug: slug } });
      if (!taken || taken.id === poi.id) return slug;
    }
    return `community-${poi.id.slice(0, 8)}`;
  }

  /** Everything the public page shows, or null when there is no published site there. */
  async data(slug: string): Promise<SiteData | null> {
    if (!SLUG_PATTERN.test(slug)) return null;
    const poi = await this.dataSource.getRepository(Poi).findOne({ where: { siteSlug: slug } });
    if (!poi || !poi.sitePublished || poi.suspendedAt || poi.closedAt) return null;
    const now = new Date();
    const timeZone = this.timeZone;
    const hidden = new Set((poi.siteHidden ?? []) as SitePart[]);
    const live = new Set<string>(
      (
        (await this.dataSource.query(`SELECT module_type AS type, status FROM active_modules WHERE poi_id = $1`, [
          poi.id,
        ])) as { type: string; status: string }[]
      )
        .filter((m) => LIVE_STATUSES.has(m.status))
        .map((m) => m.type),
    );

    const blocks: SiteData['blocks'] = await this.dataSource.query(
      `SELECT type, title, body, image_url AS "imageUrl" FROM poi_page_blocks
        WHERE poi_id = $1 AND type IN ($2, $3) ORDER BY position`,
      [poi.id, PageBlockType.TEXT, PageBlockType.IMAGE],
    );
    const messages: SiteData['messages'] = await this.dataSource.query(
      `SELECT text, important FROM poi_badges
        WHERE poi_id = $1 AND kind = 'message' AND enabled AND text IS NOT NULL
          AND (show_until IS NULL OR show_until >= CURRENT_DATE)
        ORDER BY position LIMIT 3`,
      [poi.id],
    );

    const week: SiteSlot[] = [];
    const upcoming: SiteData['upcoming'] = [];
    let nextMass: Date | null = null;
    let open: SiteData['open'] = null;
    if (live.has(ModuleType.EVENTS)) {
      const events = await this.dataSource.getRepository(Event).find({
        where: { poi: { id: poi.id } },
        order: { startsAt: 'ASC' },
        take: 400,
      });
      const today = localTime(now, timeZone);
      const dayStart = new Date(now.getTime() - (today.hour * 60 + today.minute) * 60 * 1000 - 60 * 1000);
      const weekEnd = new Date(dayStart.getTime() + 7 * DAY_MS);
      const officeSlots: SiteSlot[] = [];
      for (const event of events) {
        const duration = event.endsAt ? new Date(event.endsAt).getTime() - new Date(event.startsAt).getTime() : null;
        if (event.recurrence !== EventRecurrence.NONE) {
          for (const start of startsBetween(event, dayStart, weekEnd, timeZone)) {
            const slot = {
              start,
              end: duration ? new Date(start.getTime() + duration) : null,
              title: event.title,
              category: event.category,
            };
            week.push(slot);
            if (event.category === EventCategory.OFFICE_HOURS) officeSlots.push(slot);
          }
          // Two weeks ahead for the next Mass / opening, past this week's.
          for (const start of startsBetween(event, weekEnd, new Date(weekEnd.getTime() + 7 * DAY_MS), timeZone)) {
            if (event.category === EventCategory.OFFICE_HOURS) {
              officeSlots.push({ start, end: duration ? new Date(start.getTime() + duration) : null, title: '', category: '' });
            }
            if (event.category === EventCategory.MASS && (!nextMass || start < nextMass) && start > now) nextMass = start;
          }
        } else {
          const start = new Date(event.startsAt);
          if (start > now && start.getTime() < now.getTime() + 90 * DAY_MS && upcoming.length < 4) {
            upcoming.push({ title: event.title, start, location: event.location ?? null });
          }
          if (start >= dayStart && start < weekEnd) {
            week.push({ start, end: event.endsAt ? new Date(event.endsAt) : null, title: event.title, category: event.category });
          }
        }
      }
      week.sort((a, b) => a.start.getTime() - b.start.getTime());
      const massThisWeek = week.find((s) => s.category === EventCategory.MASS && s.start > now);
      if (massThisWeek) nextMass = massThisWeek.start;
      if (officeSlots.length) {
        officeSlots.sort((a, b) => a.start.getTime() - b.start.getTime());
        const current = officeSlots.find((s) => s.start <= now && s.end && s.end > now);
        open = current
          ? { now: true, until: current.end }
          : { now: false, next: officeSlots.find((s) => s.start > now)?.start ?? null };
      }
    }
    if (poi.type !== PoiType.CHURCH) nextMass = null;

    const news: SiteData['news'] = live.has(ModuleType.ANNOUNCEMENTS)
      ? await this.dataSource.query(
          `SELECT title, body, image_url AS "imageUrl", important, created_at AS "createdAt"
             FROM announcements WHERE poi_id = $1 ORDER BY created_at DESC LIMIT 3`,
          [poi.id],
        )
      : [];

    let campaign: SiteData['campaign'] = null;
    if (live.has(ModuleType.DONATIONS)) {
      const rows: { id: string; title: string; description: string | null; goal: string | null; imageUrl: string | null }[] =
        await this.dataSource.query(
          `SELECT id, title, description, goal_amount AS goal, image_url AS "imageUrl" FROM donation_campaigns
            WHERE poi_id = $1 AND active AND (ends_at IS NULL OR ends_at > now())
            ORDER BY created_at DESC LIMIT 1`,
          [poi.id],
        );
      if (rows[0]) {
        const sum: { total: string }[] = await this.dataSource.query(
          `SELECT COALESCE(SUM(amount), 0) AS total FROM donations WHERE campaign_id = $1 AND status = 'completed'`,
          [rows[0].id],
        );
        campaign = {
          title: rows[0].title,
          description: rows[0].description,
          goal: rows[0].goal === null ? null : Number(rows[0].goal),
          raised: Number(sum[0]?.total ?? 0),
          imageUrl: rows[0].imageUrl,
        };
      }
    }

    return {
      poi,
      timeZone,
      now,
      hidden,
      blocks,
      messages,
      week,
      upcoming,
      nextMass,
      open,
      news,
      campaign,
      currency: (this.config.get<string>('DONATION_CURRENCY') ?? 'EUR').toUpperCase(),
    };
  }
}
