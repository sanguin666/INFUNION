import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Poi } from '../../pois/entities/poi.entity.js';
import { EventCategory, EventRecurrence, type EventException } from './event-kinds.js';

/**
 * A scheduled event posted by a POI (Mass times, baptisms, weddings,
 * funerals, communions, community gatherings, etc.).
 */
@Entity('events')
@Index('IDX_events_poi', ['poi'])
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Poi, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'poi_id' })
  poi!: Relation<Poi>;

  @Column()
  title!: string;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt!: Date;

  // Optional: when it finishes, for what is shown as a span ("office open
  // 10:00 – 12:00"). For a weekly event, the end of its first occurrence.
  @Column('timestamptz', { name: 'ends_at', nullable: true })
  endsAt?: Date | null;

  // The column type has to be spelled out: TypeORM reads it from the
  // property's reflected type, and a `string | null` union reflects as
  // `Object`, which Postgres has no data type for.
  @Column('varchar', { nullable: true })
  location?: string | null;

  @Column('text', { nullable: true })
  description?: string | null;

  @Column({ type: 'enum', enum: EventCategory, default: EventCategory.OTHER })
  category!: EventCategory;

  // A repeating event starts on the day of `startsAt` and happens at its
  // time on every day its rule picks (see EventRecurrence). Occurrences
  // are worked out by whoever reads the event (the app, the dashboard)
  // rather than stored, so moving Sunday Mass by half an hour is one edit.
  @Column({ type: 'enum', enum: EventRecurrence, default: EventRecurrence.NONE })
  recurrence!: EventRecurrence;

  // Weekly: the weekdays it happens on, 0 for Sunday. Empty means the
  // weekday of `startsAt`, which is how every weekly event began.
  @Column('smallint', { name: 'repeat_days', array: true, default: () => "'{}'" })
  repeatDays!: number[];

  // Monthly, on the nth weekday: 1 to 4, or -1 for the last one.
  @Column('smallint', { name: 'monthly_week', nullable: true })
  monthlyWeek?: number | null;

  @Column('smallint', { name: 'monthly_weekday', nullable: true })
  monthlyWeekday?: number | null;

  // Monthly, on a date: 1 to 31 (a month without it is skipped).
  @Column('smallint', { name: 'monthly_day', nullable: true })
  monthlyDay?: number | null;

  // Days a repeating event does not happen, each with an optional reason.
  @Column('jsonb', { default: () => "'[]'" })
  exceptions!: EventException[];

  // The last day a repeating event still happens (a summer timetable), or
  // null when it carries on until someone changes it.
  @Column('timestamptz', { name: 'repeat_until', nullable: true })
  repeatUntil?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
