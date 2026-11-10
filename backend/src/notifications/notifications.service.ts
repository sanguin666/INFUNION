import { ForbiddenException, Injectable, Logger, NotFoundException, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { PushToken } from './entities/push-token.entity.js';
import { EventReminder } from './entities/event-reminder.entity.js';
import { DeviceFollow } from './entities/device-follow.entity.js';
import { MemberRole } from '../common/enums/member-role.enum.js';
import { UserPoi } from '../user-pois/entities/user-poi.entity.js';
import { Poi } from '../pois/entities/poi.entity.js';
import { sendsNotifications } from '../active-modules/billing-rules.js';
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

// What a phone without an account can follow: requests and messages need
// a person behind them.
const DEVICE_COLUMN: Partial<Record<NotificationKind, keyof DeviceFollow>> = {
  news: 'notifyNews',
  events: 'notifyEvents',
  live: 'notifyLive',
  readings: 'notifyReadings',
};

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
    @InjectRepository(DeviceFollow)
    private readonly followRepository: Repository<DeviceFollow>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(Poi)
    private readonly poiRepository: Repository<Poi>,
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
    const before = await this.tokenRepository.findOne({ where: { token: dto.token }, relations: { user: true } });
    // A phone used without an account, now signed in: its bells become
    // the person's, and its follows give way to their memberships.
    if (before && !before.user) await this.handOverDevice(before, userId);
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

  private async handOverDevice(device: PushToken, userId: string): Promise<void> {
    const bells = await this.reminderRepository.find({
      where: { pushToken: { id: device.id } },
      relations: { event: true },
    });
    for (const bell of bells) {
      await this.reminderRepository
        .createQueryBuilder()
        .insert()
        .values({ user: { id: userId }, event: { id: bell.event.id }, onlyDate: bell.onlyDate, nextCheckAt: null })
        .orIgnore()
        .execute();
    }
    await this.reminderRepository.delete({ pushToken: { id: device.id } });
    await this.followRepository.delete({ pushToken: { id: device.id } });
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
    // Event reminders are push notifications, which Basic doesn't have.
    if (!sendsNotifications(event.poi)) throw new ForbiddenException('notifications_not_in_plan');
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

  // ---- Phones used without an account (Seb, 9 Nov 2026) ----------------
  // The phone's own Expo push token is what identifies it: only that phone
  // was given it.

  /**
   * A phone without an account that allowed notifications. A token that
   * was a person's is theirs no more: this phone is signed out.
   */
  async registerDevice(dto: RegisterPushTokenDto): Promise<void> {
    const before = await this.tokenRepository.findOne({ where: { token: dto.token } });
    await this.tokenRepository.upsert(
      { token: dto.token, user: null, language: dto.language ?? Language.EN, timeZone: dto.timeZone ?? null },
      ['token'],
    );
    if (before && before.timeZone !== (dto.timeZone ?? null)) {
      await this.reminderRepository
        .createQueryBuilder()
        .update()
        .set({ nextCheckAt: null })
        .where('push_token_id = :id', { id: before.id })
        .execute();
    }
  }

  async removeDevice(token: string): Promise<void> {
    await this.tokenRepository.delete({ token, user: IsNull() });
  }

  /** Following a community from this phone; doing it twice is harmless. */
  async followFromDevice(token: string, poiId: string): Promise<void> {
    const device = await this.findDevice(token);
    const poi = await this.poiRepository.findOne({ where: { id: poiId }, select: { id: true } });
    if (!poi) throw new NotFoundException('Community not found');
    await this.followRepository
      .createQueryBuilder()
      .insert()
      .values({ pushToken: { id: device.id }, poi: { id: poiId } })
      .orIgnore()
      .execute();
  }

  async unfollowFromDevice(token: string, poiId: string): Promise<void> {
    const device = await this.findDevice(token);
    await this.followRepository.delete({ pushToken: { id: device.id }, poi: { id: poiId } });
    const bells = await this.reminderRepository.find({
      where: { pushToken: { id: device.id }, event: { poi: { id: poiId } } },
      select: { id: true },
    });
    if (bells.length > 0) await this.reminderRepository.delete({ id: In(bells.map((b) => b.id)) });
  }

  /** All off when the phone doesn't follow the community. */
  async getDevicePreferences(token: string, poiId: string): Promise<NotificationPreferences> {
    const device = await this.findDevice(token);
    const follow = await this.followRepository.findOne({
      where: { pushToken: { id: device.id }, poi: { id: poiId } },
    });
    return toDevicePreferences(follow);
  }

  async updateDevicePreferences(
    token: string,
    poiId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferences> {
    await this.followFromDevice(token, poiId);
    const device = await this.findDevice(token);
    const follow = await this.followRepository.findOneOrFail({
      where: { pushToken: { id: device.id }, poi: { id: poiId } },
    });
    for (const kind of Object.keys(DEVICE_COLUMN) as NotificationKind[]) {
      const value = dto[kind];
      const column = DEVICE_COLUMN[kind];
      if (value !== undefined && column) (follow as unknown as Record<string, boolean>)[column] = value;
    }
    return toDevicePreferences(await this.followRepository.save(follow));
  }

  async listDeviceEventReminders(token: string, poiId: string): Promise<EventReminderView[]> {
    const device = await this.findDevice(token);
    const reminders = await this.reminderRepository.find({
      where: { pushToken: { id: device.id }, event: { poi: { id: poiId } } },
      relations: { event: true },
    });
    return reminders.map((r) => ({ eventId: r.event.id, onlyDate: r.onlyDate ?? null }));
  }

  async addDeviceEventReminder(token: string, eventId: string, onlyDate?: string): Promise<void> {
    const event = await this.eventRepository.findOne({ where: { id: eventId }, relations: { poi: true } });
    if (!event) throw new NotFoundException('Event not found');
    if (!sendsNotifications(event.poi)) throw new ForbiddenException('notifications_not_in_plan');
    // A bell follows the community, so the reminder has somewhere to go.
    await this.followFromDevice(token, event.poi.id);
    const device = await this.findDevice(token);
    const only = repeats(event) ? (onlyDate ?? null) : null;
    const existing = await this.reminderRepository.findOne({
      where: { pushToken: { id: device.id }, event: { id: eventId } },
    });
    await this.reminderRepository.save({
      ...existing,
      pushToken: { id: device.id },
      event: { id: eventId },
      onlyDate: only,
      nextCheckAt: null,
    });
  }

  async removeDeviceEventReminder(token: string, eventId: string): Promise<void> {
    const device = await this.findDevice(token);
    await this.reminderRepository.delete({ pushToken: { id: device.id }, event: { id: eventId } });
  }

  private async findDevice(token: string): Promise<PushToken> {
    const device = await this.tokenRepository.findOne({ where: { token, user: IsNull() } });
    // The app registers again on a 404 and retries.
    if (!device) throw new NotFoundException('Unknown phone');
    return device;
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
        relations: { user: true, pushToken: true, event: { poi: true } },
        order: { nextCheckAt: { direction: 'ASC', nulls: 'FIRST' } },
        take: REMINDER_BATCH,
      });
      if (reminders.length === 0) return;
      await this.processReminders(reminders, now, until);
      if (reminders.length < REMINDER_BATCH) return;
    }
  }

  private async processReminders(reminders: EventReminder[], now: Date, until: Date): Promise<void> {
    const zones = await this.timeZonesOf(reminders.flatMap((r) => (r.user ? [r.user.id] : [])));
    for (const reminder of reminders) {
      const { event, user, pushToken } = reminder;
      // A bell left with neither (it can't be rung by anyone): drop it.
      if (!user && !pushToken) {
        await this.reminderRepository.delete({ id: reminder.id });
        continue;
      }
      const ownZone = pushToken && isTimeZone(pushToken.timeZone) ? pushToken.timeZone : undefined;
      const timeZone = (user ? zones.get(user.id) : ownZone) ?? this.defaultTimeZone;
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
      const compose: Composer = (reader) => ({
        title: text(reader.language, 'inOneHour', { title: event.title }),
        body: [formatTime(start, reader.language, reader.timeZone ?? timeZone), event.location]
          .filter(Boolean)
          .join(', '),
        data: { screen: 'event', id: event.id },
      });
      if (user) {
        await this.notifyUsers([user.id], event.poi.id, 'events', compose);
      } else if (pushToken) {
        const follow = await this.followRepository.findOne({
          where: { pushToken: { id: pushToken.id }, poi: { id: event.poi.id }, notifyEvents: true },
        });
        if (follow) await this.send([], [pushToken], event.poi.id, compose);
      }
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
      if (token.user && isTimeZone(token.timeZone)) zones.set(token.user.id, token.timeZone);
    }
    return zones;
  }

  private get defaultTimeZone(): string {
    const configured = this.configService.get<string>('DEFAULT_TIME_ZONE');
    return isTimeZone(configured) ? configured : 'Europe/Madrid';
  }

  /**
   * Everyone in a place who kept this kind on, e.g. important news, and
   * the phones following it without an account.
   */
  async notifyPoiMembers(poiId: string, kind: NotificationKind, notification: Composer): Promise<void> {
    const memberships = await this.membershipRepository.find({
      where: { poi: { id: poiId }, [PREFERENCE_COLUMN[kind]]: true },
      relations: { user: true },
    });
    const column = DEVICE_COLUMN[kind];
    const follows = column
      ? await this.followRepository.find({
          where: { poi: { id: poiId }, [column]: true },
          relations: { pushToken: true },
        })
      : [];
    await this.send(
      memberships.map((m) => m.user.id),
      follows.map((f) => f.pushToken),
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
    await this.sendToUsers([userId], poiId, notification, true);
  }

  /**
   * Every member of a place, whatever they turned off and whatever the
   * plan: for news about the place itself, such as it closing its account.
   */
  async notifyEveryMember(poiId: string, notification: Composer): Promise<void> {
    const memberships = await this.membershipRepository.find({
      where: { poi: { id: poiId }, role: MemberRole.MEMBER },
      relations: { user: true },
    });
    const follows = await this.followRepository.find({ where: { poi: { id: poiId } }, relations: { pushToken: true } });
    await this.send(
      memberships.map((m) => m.user.id),
      follows.map((f) => f.pushToken),
      poiId,
      notification,
      true,
    );
  }

  /**
   * The same as notifyPoiMembers/notifyUsers, but never throws and never
   * holds up the caller: a notification failing must not fail the news
   * post or reply that triggered it.
   */
  fireAndForget(send: () => Promise<void>): void {
    send().catch((error: Error) => this.logger.warn(`Notification failed: ${error.message}`));
  }

  // Basic has no notifications (Seb, 29 Oct 2026), apart from what only
  // concerns one person and can't wait (`always`).
  private sendToUsers(userIds: string[], poiId: string, notification: Composer, always = false): Promise<void> {
    return this.send(userIds, [], poiId, notification, always);
  }

  // The people's phones plus any phones given directly, each phone once.
  private async send(
    userIds: string[],
    devices: PushToken[],
    poiId: string,
    notification: Composer,
    always = false,
  ): Promise<void> {
    if ((userIds.length === 0 && devices.length === 0) || !this.expoPush.enabled) return;
    const poi = await this.poiRepository.findOne({
      where: { id: poiId },
      select: { id: true, name: true, plan: true, billingComped: true },
    });
    if (!poi || (!always && !sendsNotifications(poi))) return;
    const ofUsers = userIds.length > 0 ? await this.tokenRepository.find({ where: { user: { id: In(userIds) } } }) : [];
    const tokens = [...new Map([...ofUsers, ...devices].map((t) => [t.token, t])).values()];
    const messages: PushMessage[] = tokens.map((t) => {
      const written = withCommunityName(typeof notification === 'function' ? notification(t) : notification, poi.name);
      return { to: t.token, ...written, data: { ...written.data, poiId } };
    });
    const dead = await this.expoPush.send(messages);
    if (dead.length > 0) await this.tokenRepository.delete({ token: In(dead) });
  }

  private async findMembership(userId: string, poiId: string): Promise<UserPoi> {
    const membership = await this.membershipRepository.findOne({
      where: { user: { id: userId }, poi: { id: poiId } },
    });
    if (!membership) throw new NotFoundException('Not a member of this community');
    return membership;
  }
}

/**
 * Every notification says which community it comes from (Seb, 4 Nov
 * 2026): the community's name is the title, and a title of its own
 * ("In 1 hour: Mass") moves to the first line of the message. A title
 * that already names the community stays as it is.
 */
export function withCommunityName(notification: Notification, name: string): Notification {
  const title = notification.title.trim();
  if (!name || title.includes(name)) return notification;
  const body = [title, notification.body.trim()].filter(Boolean).join('\n');
  return { ...notification, title: name, body };
}

function toDevicePreferences(follow: DeviceFollow | null): NotificationPreferences {
  return {
    news: follow?.notifyNews ?? false,
    requests: false,
    events: follow?.notifyEvents ?? false,
    live: follow?.notifyLive ?? false,
    readings: follow?.notifyReadings ?? false,
    messages: false,
  };
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
