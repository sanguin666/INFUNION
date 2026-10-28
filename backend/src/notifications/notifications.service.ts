import { Injectable, Logger, NotFoundException, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { PushToken } from './entities/push-token.entity.js';
import { EventReminder } from './entities/event-reminder.entity.js';
import { UserPoi } from '../user-pois/entities/user-poi.entity.js';
import { Event } from '../events/entities/event.entity.js';
import { Language } from '../common/enums/language.enum.js';
import { ExpoPushClient, type PushMessage } from './expo-push.client.js';
import { formatTime, text } from './texts.js';
import { runExclusive } from '../common/locks/run-exclusive.js';
import { dayKey, isTimeZone, localTime, repeats, startsBetween } from '../events/occurrences.js';
import type { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto.js';
import type { RegisterPushTokenDto } from './dto/register-push-token.dto.js';

export type NotificationKind = 'news' | 'requests' | 'events' | 'live' | 'readings' | 'messages';

export interface NotificationPreferences {
  news: boolean;
  requests: boolean;
  events: boolean;
  live: boolean;
  readings: boolean;
  messages: boolean;
}

export interface Notification {
  title: string;
  body: string;
  // Read by the app when the notification is tapped: `screen` and `id`
  // say what to open. `poiId` is added here, for every notification.
  data?: Record<string, string>;
}

/** A bell as the app sees it: which event, and whether for one day only. */
export interface EventReminderView {
  eventId: string;
  onlyDate: string | null;
}

/** Who a notification is for, so it can be written in their words. */
export interface Reader {
  language: Language;
  timeZone?: string | null;
}

/** A notification, or how to write it for one reader. */
export type Composer = Notification | ((reader: Reader) => Notification);

const PREFERENCE_COLUMN = {
  news: 'notifyNews',
  requests: 'notifyRequests',
  events: 'notifyEvents',
  live: 'notifyLive',
  readings: 'notifyReadings',
  messages: 'notifyMessages',
} as const satisfies Record<NotificationKind, keyof UserPoi>;

const REMINDER_LEAD_MS = 60 * 60 * 1000;
const REMINDER_SWEEP_MS = 60 * 1000;
const REMINDER_BATCH = 500;
// How far ahead a bell looks for its next time; with none in sight it
// looks again in a week (an event that ended, or moved far away).
const LOOKAHEAD_MS = 45 * 24 * 60 * 60 * 1000;
const RECHECK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * When the sweep next needs this bell: an hour before its next time after
 * `after` (the time just reminded, or now), never earlier than the next
 * sweep and never later than a week away.
 */
function nextCheck(event: Event, after: Date, now: Date, timeZone: string, fits: (start: Date) => boolean): Date {
  const next = startsBetween(event, after, new Date(after.getTime() + LOOKAHEAD_MS), timeZone).find(fits);
  const latest = now.getTime() + RECHECK_MS;
  if (!next) return new Date(latest);
  return new Date(Math.min(latest, Math.max(now.getTime() + 1, next.getTime() - REMINDER_LEAD_MS)));
}

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private sweep?: NodeJS.Timeout;

  constructor(
    @InjectRepository(PushToken)
    private readonly tokenRepository: Repository<PushToken>,
    @InjectRepository(UserPoi)
    private readonly membershipRepository: Repository<UserPoi>,
    @InjectRepository(EventReminder)
    private readonly reminderRepository: Repository<EventReminder>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    private readonly expoPush: ExpoPushClient,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    // Tests call sendDueEventReminders themselves, with a clock of their own.
    if (this.configService.get<string>('NODE_ENV') === 'test') return;
    // Every copy of the API ticks; one at a time does the sending.
    this.sweep = setInterval(() => {
      runExclusive(this.reminderRepository.manager.connection, 'event-reminders', () =>
        this.sendDueEventReminders(),
      ).catch((error: Error) =>
        this.logger.warn(`Event reminders failed: ${error.message}`),
      );
    }, REMINDER_SWEEP_MS);
  }

  onModuleDestroy(): void {
    if (this.sweep) clearInterval(this.sweep);
  }

  async registerToken(userId: string, dto: RegisterPushTokenDto): Promise<void> {
    const before = await this.tokenRepository.findOne({ where: { token: dto.token } });
    // Upsert on the token: a phone that changes hands moves to its new
    // owner instead of notifying both.
    await this.tokenRepository.upsert(
      {
        token: dto.token,
        user: { id: userId },
        language: dto.language ?? Language.EN,
        timeZone: dto.timeZone ?? null,
      },
      ['token'],
    );
    // A new phone or a new time zone: their bells' next times move.
    if (!before || before.timeZone !== (dto.timeZone ?? null)) {
      await this.reminderRepository
        .createQueryBuilder()
        .update()
        .set({ nextCheckAt: null })
        .where('user_id = :userId', { userId })
        .execute();
    }
  }

  async removeToken(userId: string, token: string): Promise<void> {
    await this.tokenRepository.delete({ token, user: { id: userId } });
  }

  async getPreferences(userId: string, poiId: string): Promise<NotificationPreferences> {
    return toPreferences(await this.findMembership(userId, poiId));
  }

  async updatePreferences(
    userId: string,
    poiId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferences> {
    const membership = await this.findMembership(userId, poiId);
    for (const kind of Object.keys(PREFERENCE_COLUMN) as NotificationKind[]) {
      const value = dto[kind];
      if (value !== undefined) membership[PREFERENCE_COLUMN[kind]] = value;
    }
    return toPreferences(await this.membershipRepository.save(membership));
  }

  /** The events in a place this person rang the bell for. */
  async listEventReminders(userId: string, poiId: string): Promise<EventReminderView[]> {
    await this.findMembership(userId, poiId);
    const reminders = await this.reminderRepository.find({
      where: { user: { id: userId }, event: { poi: { id: poiId } } },
      relations: { event: true },
    });
    return reminders.map((r) => ({ eventId: r.event.id, onlyDate: r.onlyDate ?? null }));
  }

  async addEventReminder(userId: string, eventId: string, onlyDate?: string): Promise<void> {
    const event = await this.eventRepository.findOne({ where: { id: eventId }, relations: { poi: true } });
    if (!event) throw new NotFoundException('Event not found');
    await this.findMembership(userId, event.poi.id);
    // A one-off event has one day anyway.
    const only = repeats(event) ? (onlyDate ?? null) : null;
    await this.reminderRepository.upsert({ user: { id: userId }, event: { id: eventId }, onlyDate: only, nextCheckAt: null }, [
      'user',
      'event',
    ]);
  }

  async removeEventReminder(userId: string, eventId: string): Promise<void> {
    await this.reminderRepository.delete({ user: { id: userId }, event: { id: eventId } });
  }

  /**
   * Sends a reminder for every belled event starting within the next
   * hour: a one-off event once, a repeating one once for each time it
   * happens (days off skipped), a one-day bell once and then dropped.
   * Repeating times are read in the person's own time zone, from their
   * phone. Runs every minute; `now` is there for tests.
   */
  async sendDueEventReminders(now = new Date()): Promise<void> {
    const until = new Date(now.getTime() + REMINDER_LEAD_MS);
    // In batches, so a sweep after downtime never loads everything at once.
    for (;;) {
      const reminders = await this.reminderRepository.find({
        where: [{ nextCheckAt: IsNull() }, { nextCheckAt: LessThanOrEqual(now) }],
        relations: { user: true, event: { poi: true } },
        order: { nextCheckAt: { direction: 'ASC', nulls: 'FIRST' } },
        take: REMINDER_BATCH,
      });
      if (reminders.length === 0) return;
      await this.processReminders(reminders, now, until);
      if (reminders.length < REMINDER_BATCH) return;
    }
  }

  private async processReminders(reminders: EventReminder[], now: Date, until: Date): Promise<void> {
    const zones = await this.timeZonesOf(reminders.map((r) => r.user.id));
    for (const reminder of reminders) {
      const { event } = reminder;
      const timeZone = zones.get(reminder.user.id) ?? this.defaultTimeZone;
      const today = dayKey(localTime(now, timeZone));
      if (reminder.onlyDate && reminder.onlyDate < today) {
        // A one-day bell for a day gone by (a day off, say): nothing left to ring.
        await this.reminderRepository.delete({ id: reminder.id });
        continue;
      }
      const fits = (s: Date) => !reminder.onlyDate || dayKey(localTime(s, timeZone)) === reminder.onlyDate;
      const start = startsBetween(event, now, until, timeZone).find(fits);
      const due = !!start && reminder.remindedFor?.getTime() !== start.getTime();

      if (due && reminder.onlyDate) {
        await this.reminderRepository.delete({ id: reminder.id });
      } else {
        if (due) {
          reminder.remindedAt = now;
          reminder.remindedFor = start;
        }
        reminder.nextCheckAt = nextCheck(event, start ?? now, now, timeZone, fits);
        await this.reminderRepository.save(reminder);
      }
      if (!due) continue;
      await this.notifyUsers([reminder.user.id], event.poi.id, 'events', (reader) => ({
        title: text(reader.language, 'inOneHour', { title: event.title }),
        body: [formatTime(start, reader.language, reader.timeZone ?? timeZone), event.location]
          .filter(Boolean)
          .join(', '),
        data: { screen: 'event', id: event.id },
      }));
    }
  }

  // Each person's time zone, from the phone that last told us one.
  private async timeZonesOf(userIds: string[]): Promise<Map<string, string>> {
    const tokens = await this.tokenRepository.find({
      where: { user: { id: In([...new Set(userIds)]) } },
      relations: { user: true },
      order: { updatedAt: 'ASC' },
    });
    const zones = new Map<string, string>();
    for (const token of tokens) {
      if (isTimeZone(token.timeZone)) zones.set(token.user.id, token.timeZone);
    }
    return zones;
  }

  private get defaultTimeZone(): string {
    const configured = this.configService.get<string>('DEFAULT_TIME_ZONE');
    return isTimeZone(configured) ? configured : 'Europe/Madrid';
  }

  /** Everyone in a place who kept this kind on, e.g. important news. */
  async notifyPoiMembers(poiId: string, kind: NotificationKind, notification: Composer): Promise<void> {
    const memberships = await this.membershipRepository.find({
      where: { poi: { id: poiId }, [PREFERENCE_COLUMN[kind]]: true },
      relations: { user: true },
    });
    await this.sendToUsers(
      memberships.map((m) => m.user.id),
      poiId,
      notification,
    );
  }

  /**
   * Particular people in a place (the person whose request got a reply,
   * those who belled an event), minus anyone who turned that kind off.
   */
  async notifyUsers(
    userIds: string[],
    poiId: string,
    kind: NotificationKind,
    notification: Composer,
  ): Promise<void> {
    if (userIds.length === 0) return;
    const memberships = await this.membershipRepository.find({
      where: { poi: { id: poiId }, user: { id: In(userIds) }, [PREFERENCE_COLUMN[kind]]: true },
      relations: { user: true },
    });
    await this.sendToUsers(
      memberships.map((m) => m.user.id),
      poiId,
      notification,
    );
  }

  /**
   * One person, whatever kinds they turned off: for what concerns only
   * them and can't wait, such as their own monthly gift failing.
   */
  async notifyUserAlways(userId: string, poiId: string, notification: Composer): Promise<void> {
    await this.sendToUsers([userId], poiId, notification);
  }

  /**
   * The same as notifyPoiMembers/notifyUsers, but never throws and never
   * holds up the caller: a notification failing must not fail the news
   * post or reply that triggered it.
   */
  fireAndForget(send: () => Promise<void>): void {
    send().catch((error: Error) => this.logger.warn(`Notification failed: ${error.message}`));
  }

  private async sendToUsers(userIds: string[], poiId: string, notification: Composer): Promise<void> {
    if (userIds.length === 0 || !this.expoPush.enabled) return;
    const tokens = await this.tokenRepository.find({ where: { user: { id: In(userIds) } } });
    const messages: PushMessage[] = tokens.map((t) => {
      const written = typeof notification === 'function' ? notification(t) : notification;
      return { to: t.token, ...written, data: { ...written.data, poiId } };
    });
    const dead = await this.expoPush.send(messages);
    if (dead.length > 0) await this.tokenRepository.delete({ token: In(dead) });
  }

  private async findMembership(userId: string, poiId: string): Promise<UserPoi> {
    const membership = await this.membershipRepository.findOne({
      where: { user: { id: userId }, poi: { id: poiId } },
    });
    if (!membership) throw new NotFoundException('Not a member of this place');
    return membership;
  }
}

function toPreferences(membership: UserPoi): NotificationPreferences {
  return {
    news: membership.notifyNews,
    requests: membership.notifyRequests,
    events: membership.notifyEvents,
    live: membership.notifyLive,
    readings: membership.notifyReadings,
    messages: membership.notifyMessages,
  };
}
