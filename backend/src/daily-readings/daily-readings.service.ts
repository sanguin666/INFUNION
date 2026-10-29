import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, IsNull, LessThanOrEqual, Not, Repository } from 'typeorm';
import { DailyReading } from './entities/daily-reading.entity.js';
import { DATE_PATTERN, type SaveDailyReadingDto } from './dto/daily-reading.dto.js';
import { PoisService } from '../pois/pois.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ActiveModule } from '../active-modules/entities/active-module.entity.js';
import { ModuleType } from '../common/enums/module-type.enum.js';
import { ModuleStatus } from '../common/enums/module-status.enum.js';
import { moduleFitsPlace } from '../active-modules/module-places.js';
import { dayKey, isTimeZone, localTime } from '../events/occurrences.js';
import { text } from '../notifications/texts.js';
import { runExclusive } from '../common/locks/run-exclusive.js';

// How far back the app can page: two months of days.
const HISTORY_DAYS = 60;
const SWEEP_MS = 60 * 1000;

export interface ReadingsSettings {
  linkUrl: string | null;
}

@Injectable()
export class DailyReadingsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DailyReadingsService.name);
  private sweep?: NodeJS.Timeout;

  constructor(
    @InjectRepository(DailyReading)
    private readonly repository: Repository<DailyReading>,
    @InjectRepository(ActiveModule)
    private readonly modulesRepository: Repository<ActiveModule>,
    private readonly poisService: PoisService,
    private readonly notifications: NotificationsService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    // Tests call sendDueNotifications themselves, with a clock of their own.
    if (this.configService.get<string>('NODE_ENV') === 'test') return;
    // Every copy of the API ticks; one at a time does the sending.
    this.sweep = setInterval(() => {
      runExclusive(this.repository.manager.connection, 'daily-readings', () =>
        this.sendDueNotifications(),
      ).catch((error: Error) =>
        this.logger.warn(`Readings notifications failed: ${error.message}`),
      );
    }, SWEEP_MS);
  }

  onModuleDestroy(): void {
    if (this.sweep) clearInterval(this.sweep);
  }

  async settings(poiId: string): Promise<ReadingsSettings> {
    const poi = await this.poisService.findOne(poiId);
    return { linkUrl: poi.readingsLinkUrl ?? null };
  }

  async updateSettings(poiId: string, linkUrl: string | null): Promise<ReadingsSettings> {
    const poi = await this.poisService.update(poiId, { readingsLinkUrl: linkUrl });
    return { linkUrl: poi.readingsLinkUrl ?? null };
  }

  /**
   * What members see: published days up to today, newest first. `today`
   * is the phone's own date, so a member abroad gets their own midnight,
   * but never more than a day ahead of the place's.
   */
  async listPublished(poiId: string, today?: string): Promise<DailyReading[]> {
    const placeToday = this.today();
    const limit = dayKey(addDays(placeToday, 1));
    const upTo = today && DATE_PATTERN.test(today) && today < limit ? today : dayKey(placeToday);
    return this.repository.find({
      where: { poi: { id: poiId }, published: true, date: LessThanOrEqual(upTo) },
      order: { date: 'DESC' },
      take: HISTORY_DAYS,
    });
  }

  /** Every day, drafts too, between two dates: the admin's week. */
  listForOffice(poiId: string, from: string, to: string): Promise<DailyReading[]> {
    if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to)) {
      throw new BadRequestException('from and to must be YYYY-MM-DD');
    }
    return this.repository.find({
      where: { poi: { id: poiId }, date: Between(from, to) },
      order: { date: 'ASC' },
    });
  }

  async save(poiId: string, date: string, dto: SaveDailyReadingDto): Promise<DailyReading> {
    assertDate(date);
    if (dto.published && dto.sections.length === 0 && !dto.word) {
      throw new BadRequestException('Nothing to publish');
    }
    const existing = await this.repository.findOne({ where: { poi: { id: poiId }, date } });
    const reading = existing ?? this.repository.create({ poi: await this.poisService.findOne(poiId), date });
    reading.word = dto.word ?? null;
    reading.sections = dto.sections.map((s) => ({
      kind: s.kind,
      title: s.title ?? null,
      reference: s.reference ?? null,
      text: s.text,
    }));
    reading.published = dto.published;
    reading.notifyAt = dto.notifyAt ?? null;
    return this.repository.save(reading);
  }

  async remove(poiId: string, date: string): Promise<void> {
    assertDate(date);
    const reading = await this.repository.findOne({ where: { poi: { id: poiId }, date } });
    if (!reading) throw new NotFoundException(`No readings on ${date}`);
    await this.repository.remove(reading);
  }

  /**
   * Tells members that today's readings are there, once, at the time the
   * office chose. A day published after that time notifies straight
   * away; a day gone by never does. Runs every minute; `now` is there for
   * tests.
   */
  async sendDueNotifications(now = new Date()): Promise<void> {
    const clock = localTime(now, this.timeZone);
    const today = dayKey(clock);
    const due = await this.repository.find({
      where: { date: today, published: true, notifyAt: Not(IsNull()), notifiedAt: IsNull() },
      relations: { poi: true },
    });
    const time = `${String(clock.hour).padStart(2, '0')}:${String(clock.minute).padStart(2, '0')}`;
    const ready = due.filter((r) => r.notifyAt! <= time);
    if (ready.length === 0) return;

    const running = await this.modulesRepository.find({
      where: {
        poi: { id: In(ready.map((r) => r.poi.id)) },
        moduleType: ModuleType.DAILY_READINGS,
        status: In([ModuleStatus.TRIAL, ModuleStatus.ACTIVE]),
      },
      relations: { poi: true },
    });
    const live = new Set(
      running.filter((m) => moduleFitsPlace(m.moduleType, m.poi.type)).map((m) => m.poi.id),
    );

    for (const reading of ready) {
      reading.notifiedAt = now;
      await this.repository.save(reading);
      if (!live.has(reading.poi.id)) continue;
      const poi = reading.poi;
      await this.notifications.notifyPoiMembers(poi.id, 'readings', (reader) => ({
        title: poi.name,
        body: text(reader.language, 'readingsReady'),
        data: { screen: 'readings', id: reading.date },
      }));
    }
  }

  private today() {
    return localTime(new Date(), this.timeZone);
  }

  private get timeZone(): string {
    const configured = this.configService.get<string>('DEFAULT_TIME_ZONE');
    return isTimeZone(configured) ? configured : 'Europe/Madrid';
  }
}

function assertDate(date: string) {
  if (!DATE_PATTERN.test(date)) throw new BadRequestException('date must be YYYY-MM-DD');
}

function addDays(day: { year: number; month: number; day: number }, days: number) {
  const date = new Date(Date.UTC(day.year, day.month - 1, day.day + days));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}
