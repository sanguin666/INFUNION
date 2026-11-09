import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, MoreThan } from 'typeorm';
import { AssistantModel, type AssistantTurn } from './assistant-model.js';
import { recordAssistantQuestion } from './assistant-questions.js';
import { Poi } from '../pois/entities/poi.entity.js';
import { UserPoi } from '../user-pois/entities/user-poi.entity.js';
import { Event } from '../events/entities/event.entity.js';
import { EventRecurrence } from '../events/entities/event-kinds.js';
import { Announcement } from '../announcements/entities/announcement.entity.js';
import { PoiPageBlock } from '../poi-page/entities/poi-page-block.entity.js';
import { Livestream } from '../livestreams/entities/livestream.entity.js';
import { ActiveModulesService } from '../active-modules/active-modules.service.js';
import { effectivePlan } from '../active-modules/billing-rules.js';
import { PlanTier } from '../common/enums/plan-tier.enum.js';
import { ModuleType } from '../common/enums/module-type.enum.js';
import { PoiType } from '../common/enums/poi-type.enum.js';
import { PageBlockType } from '../common/enums/page-block-type.enum.js';
import { LivestreamStatus } from '../common/enums/livestream-status.enum.js';
import { isTimeZone, localTime } from '../events/occurrences.js';

// Questions per member per day, across communities (Seb, 5 Nov 2026:
// "a daily limit per member to keep costs low").
export const DAILY_QUESTIONS = 20;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const ORDINALS: Record<number, string> = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth', [-1]: 'last' };

// What a member can ask the team for, as in the app (app/src/utils/requestTypes.ts).
const CHURCH_REQUESTS = 'baptism, wedding, funeral, certificate (baptism, marriage…), meeting with the priest or the team, first communion, confirmation, visit to someone who is ill, blessing, something else';
const GENERAL_REQUESTS = 'registration for an activity, meeting with the team, certificate or document, something else';

export type AssistantStatus = { available: boolean; remaining: number };
export type AssistantAnswer = { answer: string; actions: string[]; remaining: number };

function clip(text: string | null | undefined, max: number): string {
  const clean = (text ?? '').replace(/\s+\n/g, '\n').trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

/**
 * The member assistant (Seb, 5 Nov 2026, #136): a member asks a question
 * about their community and gets a short answer in their language, with
 * buttons to the right screens. It knows only what the community has
 * published (home page, events, news, livestreams, modules), never any
 * member's data. Complete plan, signed-in members, a daily limit.
 */
@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly model: AssistantModel,
    private readonly modules: ActiveModulesService,
    private readonly config: ConfigService,
  ) {}

  private get timeZone(): string {
    const configured = this.config.get<string>('DEFAULT_TIME_ZONE');
    return isTimeZone(configured) ? configured : 'Europe/Madrid';
  }

  private async load(poiId: string, userId: string): Promise<Poi> {
    const poi = await this.dataSource.getRepository(Poi).findOne({ where: { id: poiId } });
    if (!poi) throw new NotFoundException('Unknown community');
    const member = await this.dataSource
      .getRepository(UserPoi)
      .exists({ where: { user: { id: userId }, poi: { id: poiId } } });
    if (!member) throw new ForbiddenException('not_a_member');
    return poi;
  }

  private available(poi: Poi): boolean {
    return effectivePlan(poi) === PlanTier.COMPLETE && this.model.enabled;
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private async used(userId: string): Promise<number> {
    const rows: { count: number }[] = await this.dataSource.query(
      `SELECT count FROM assistant_usage WHERE user_id = $1 AND day = $2`,
      [userId, this.today()],
    );
    return rows[0]?.count ?? 0;
  }

  async status(poiId: string, userId: string): Promise<AssistantStatus> {
    const poi = await this.load(poiId, userId);
    const remaining = Math.max(0, DAILY_QUESTIONS - (await this.used(userId)));
    return { available: this.available(poi), remaining };
  }

  async ask(poiId: string, userId: string, turns: AssistantTurn[], language: string): Promise<AssistantAnswer> {
    const poi = await this.load(poiId, userId);
    if (effectivePlan(poi) !== PlanTier.COMPLETE) throw new ForbiddenException('not_in_plan');
    if (!this.model.enabled) throw new ServiceUnavailableException('assistant_off');
    if (turns.length === 0 || turns[turns.length - 1].role !== 'member') {
      throw new HttpException('last_turn_not_member', HttpStatus.BAD_REQUEST);
    }

    // Counted before asking, in one statement, so two taps at once can't
    // both slip under the limit.
    const counted: { count: number }[] = await this.dataSource.query(
      `INSERT INTO assistant_usage (user_id, day, count) VALUES ($1, $2, 1)
       ON CONFLICT (user_id, day) DO UPDATE SET count = assistant_usage.count + 1
       WHERE assistant_usage.count < $3
       RETURNING count`,
      [userId, this.today(), DAILY_QUESTIONS],
    );
    if (counted.length === 0) throw new HttpException('daily_limit', HttpStatus.TOO_MANY_REQUESTS);
    const remaining = DAILY_QUESTIONS - counted[0].count;

    const live = new Set(
      (await this.modules.findActiveModulesForPoi(poi.id))
        .filter((m) => m.status === 'trial' || m.status === 'active')
        .map((m) => m.moduleType),
    );
    try {
      const { insight, ...reply } = await this.model.answer({
        community: poi.name,
        info: await this.info(poi, live),
        screens: this.screens(poi, live),
        language,
        turns,
      });
      await recordAssistantQuestion(this.dataSource, this.logger, poi.id, 'member', language, insight);
      return { ...reply, remaining };
    } catch (error) {
      // Not counted when nothing came back.
      await this.dataSource.query(
        `UPDATE assistant_usage SET count = GREATEST(count - 1, 0) WHERE user_id = $1 AND day = $2`,
        [userId, this.today()],
      );
      this.logger.warn(`Assistant failed for ${poi.id}: ${(error as Error).message}`);
      throw new ServiceUnavailableException('assistant_failed');
    }
  }

  /** The screens the answer may send the member to, and what each is for. */
  private screens(poi: Poi, live: Set<ModuleType>): Record<string, string> {
    const church = poi.type === PoiType.CHURCH;
    const all: [ModuleType | null, string, string][] = [
      [null, 'home', "Home: the community's home page"],
      [ModuleType.EVENTS, 'events', 'Events: the regular timetable and what is coming up'],
      [ModuleType.EVENTS, 'calendar', 'Calendar: what is on, day by day'],
      [ModuleType.ANNOUNCEMENTS, 'announcements', "News: the team's announcements"],
      [ModuleType.DONATIONS, 'donations', 'Contribute: give money to the community online, once or every month, with a tax receipt on request'],
      [ModuleType.REQUESTS, 'requests', "Requests: the member's own requests to the team and how each one is going"],
      [ModuleType.REQUESTS, 'new_request', `New request: ask the team for something (${church ? CHURCH_REQUESTS : GENERAL_REQUESTS})`],
      [ModuleType.MESSAGES, 'messages', 'Messages: write to the team, and read what the team wrote to the member'],
      [ModuleType.COMMUNITY, 'community', 'Our group: posts and conversations between members'],
      [ModuleType.LIVESTREAMS, 'livestreams', 'Livestream: watch live or replay'],
      [ModuleType.PRAYER_REQUESTS, 'prayer_requests', 'Prayer requests: share an intention and pray for others'],
      [ModuleType.DAILY_READINGS, 'daily_readings', "Daily readings: today's texts"],
      [
        ModuleType.MASS_INTENTIONS,
        'mass_intentions',
        `Mass intentions: ask for a Mass to be offered for someone${poi.massIntentionOffering ? ` (suggested offering ${poi.massIntentionOffering} €)` : ''}`,
      ],
    ];
    return Object.fromEntries(all.filter(([type]) => !type || live.has(type)).map(([, key, text]) => [key, text]));
  }

  private when(date: Date): string {
    const t = localTime(date, this.timeZone);
    return `${WEEKDAY_NAMES[t.weekday]} ${t.day} ${MONTH_NAMES[t.month - 1]} ${t.year}`;
  }

  private clock(date: Date): string {
    const t = localTime(date, this.timeZone);
    return `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
  }

  private span(event: Event): string {
    const start = new Date(event.startsAt);
    return event.endsAt ? `${this.clock(start)}–${this.clock(new Date(event.endsAt))}` : this.clock(start);
  }

  private repeatsText(event: Event): string {
    const start = localTime(new Date(event.startsAt), this.timeZone);
    let rule: string;
    if (event.recurrence === EventRecurrence.MONTHLY) {
      rule = event.monthlyDay
        ? `every month on day ${event.monthlyDay}`
        : `the ${ORDINALS[event.monthlyWeek ?? 1] ?? 'first'} ${WEEKDAY_NAMES[event.monthlyWeekday ?? start.weekday]} of every month`;
    } else {
      const days = event.repeatDays?.length ? [...event.repeatDays].sort() : [start.weekday];
      rule = days.length === 7 ? 'every day' : `every ${days.map((d) => WEEKDAY_NAMES[d]).join(', ')}`;
    }
    const parts = [`${rule} at ${this.span(event)}`];
    if (event.repeatUntil) parts.push(`until ${this.when(new Date(event.repeatUntil))}`);
    const today = new Date().toISOString().slice(0, 10);
    const skipped = (event.exceptions ?? []).map((e) => e.date).filter((d) => d >= today).slice(0, 5);
    if (skipped.length) parts.push(`not on ${skipped.join(', ')}`);
    return parts.join(', ');
  }

  /** What the community has published, as plain text for the model. */
  private async info(poi: Poi, live: Set<ModuleType>): Promise<string> {
    const now = new Date();
    const lines: string[] = [];
    lines.push(`Community: ${poi.name} (${poi.type.replace('_', ' ')})`);
    if (poi.description) lines.push(`About: ${clip(poi.description, 800)}`);
    const address = [poi.address, poi.postalCode, poi.city].filter(Boolean).join(', ');
    if (address) lines.push(`Address: ${address}`);
    lines.push(`Today: ${this.when(now)}, ${this.clock(now)} (local time)`);

    const blocks = await this.dataSource.getRepository(PoiPageBlock).find({
      where: { poi: { id: poi.id }, type: PageBlockType.TEXT },
      order: { position: 'ASC' },
      take: 12,
    });
    if (blocks.length) {
      lines.push('', 'Home page:');
      for (const block of blocks) {
        lines.push(`- ${[block.title, clip(block.body, 1200)].filter(Boolean).join(': ')}`);
      }
    }

    if (live.has(ModuleType.EVENTS)) {
      const events = await this.dataSource.getRepository(Event).find({
        where: { poi: { id: poi.id } },
        order: { startsAt: 'ASC' },
        take: 300,
      });
      const regular = events.filter((e) => e.recurrence !== EventRecurrence.NONE).slice(0, 60);
      const horizon = new Date(now.getTime() + 120 * DAY_MS);
      const once = events
        .filter((e) => e.recurrence === EventRecurrence.NONE)
        .filter((e) => new Date(e.endsAt ?? e.startsAt) >= now && new Date(e.startsAt) <= horizon)
        .slice(0, 40);
      const describe = (e: Event, when: string) =>
        `- ${e.title} (${e.category === 'office_hours' ? 'opening hours of the team' : e.category}): ${when}${e.location ? `, at ${e.location}` : ''}${e.description ? `. ${clip(e.description, 300)}` : ''}`;
      if (regular.length) {
        lines.push('', 'Regular timetable:');
        for (const e of regular) lines.push(describe(e, this.repeatsText(e)));
      }
      if (once.length) {
        lines.push('', 'Coming up:');
        for (const e of once) lines.push(describe(e, `${this.when(new Date(e.startsAt))} at ${this.span(e)}`));
      }
    }

    if (live.has(ModuleType.ANNOUNCEMENTS)) {
      const news = await this.dataSource.getRepository(Announcement).find({
        where: { poi: { id: poi.id }, createdAt: MoreThan(new Date(now.getTime() - 90 * DAY_MS)) },
        order: { createdAt: 'DESC' },
        take: 8,
      });
      if (news.length) {
        lines.push('', 'Latest news:');
        for (const n of news) {
          lines.push(`- ${this.when(new Date(n.createdAt))}: ${n.title}${n.body ? `. ${clip(n.body, 500)}` : ''}`);
        }
      }
    }

    if (live.has(ModuleType.LIVESTREAMS)) {
      const streams = await this.dataSource.getRepository(Livestream).find({
        where: { poi: { id: poi.id }, status: In([LivestreamStatus.UPCOMING, LivestreamStatus.LIVE]) },
        order: { scheduledAt: 'ASC' },
        take: 4,
      });
      if (streams.length) {
        lines.push('', 'Livestreams:');
        for (const s of streams) {
          lines.push(`- ${s.title}: ${s.status === LivestreamStatus.LIVE ? 'live now' : `${this.when(new Date(s.scheduledAt))} at ${this.clock(new Date(s.scheduledAt))}`}`);
        }
      }
    }
    return lines.join('\n');
  }
}
