import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from './entities/event.entity.js';
import { EventReminder } from '../notifications/entities/event-reminder.entity.js';
import { EventRecurrence } from './entities/event-kinds.js';
import { PoisService } from '../pois/pois.service.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { UpdateEventDto } from './dto/update-event.dto.js';

/**
 * Keeps only what the event's kind of repetition uses, so switching a
 * weekly Mass to once a month (or to a one-off) leaves nothing behind that
 * a reader could misread, and refuses a monthly event with no rule.
 */
function normalised(event: Event): Event {
  const weekly = event.recurrence === EventRecurrence.WEEKLY;
  const monthly = event.recurrence === EventRecurrence.MONTHLY;
  event.repeatDays = weekly ? [...new Set(event.repeatDays ?? [])].sort((a, b) => a - b) : [];
  if (monthly) {
    const byWeekday = event.monthlyWeek != null && event.monthlyWeekday != null;
    if (!byWeekday && event.monthlyDay == null) {
      throw new BadRequestException('Say which day of the month');
    }
    if (byWeekday) event.monthlyDay = null;
    else {
      event.monthlyWeek = null;
      event.monthlyWeekday = null;
    }
  } else {
    event.monthlyWeek = null;
    event.monthlyWeekday = null;
    event.monthlyDay = null;
  }
  if (event.recurrence === EventRecurrence.NONE) {
    event.repeatUntil = null;
    event.exceptions = [];
  }
  event.exceptions = [...(event.exceptions ?? [])]
    .map((e) => ({ date: e.date, reason: e.reason ?? null }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return event;
}

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,
    private readonly poisService: PoisService,
  ) {}

  async create(poiId: string, dto: CreateEventDto): Promise<Event> {
    const poi = await this.poisService.findOne(poiId);
    const event = this.eventsRepository.create({
      ...dto,
      startsAt: new Date(dto.startsAt),
      endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      repeatUntil: dto.repeatUntil ? new Date(dto.repeatUntil) : null,
      poi,
    });
    return this.eventsRepository.save(normalised(event));
  }

  findForPoi(poiId: string): Promise<Event[]> {
    return this.eventsRepository.find({
      where: { poi: { id: poiId } },
      order: { startsAt: 'ASC' },
    });
  }

  async update(poiId: string, id: string, dto: UpdateEventDto): Promise<Event> {
    const event = await this.findOneForPoi(poiId, id);
    Object.assign(event, {
      ...dto,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : event.startsAt,
      endsAt: dto.endsAt === undefined ? event.endsAt : dto.endsAt ? new Date(dto.endsAt) : null,
      repeatUntil:
        dto.repeatUntil === undefined
          ? event.repeatUntil
          : dto.repeatUntil
            ? new Date(dto.repeatUntil)
            : null,
    });
    const saved = await this.eventsRepository.save(normalised(event));
    // Its time or days may have moved: bells on it work out their next
    // time again on the next sweep.
    await this.eventsRepository.manager
      .createQueryBuilder()
      .update(EventReminder)
      .set({ nextCheckAt: null })
      .where('event_id = :id', { id: saved.id })
      .execute();
    return saved;
  }

  async remove(poiId: string, id: string): Promise<void> {
    const event = await this.findOneForPoi(poiId, id);
    await this.eventsRepository.remove(event);
  }

  private async findOneForPoi(poiId: string, id: string): Promise<Event> {
    const event = await this.eventsRepository.findOne({
      where: { id, poi: { id: poiId } },
    });
    if (!event) {
      throw new NotFoundException(`Event ${id} not found`);
    }
    return event;
  }
}
