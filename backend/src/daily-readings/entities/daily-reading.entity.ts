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

export const READING_KINDS = ['first', 'psalm', 'second', 'gospel', 'other'] as const;
export type ReadingKind = (typeof READING_KINDS)[number];

/** One text of the day: a reading, the psalm, the Gospel, or anything else. */
export interface ReadingSection {
  kind: ReadingKind;
  // Shown instead of the kind's own name when set, e.g. for 'other'.
  title?: string | null;
  // "Lc 10, 1-12": written by the office, never looked up.
  reference?: string | null;
  text: string;
}

/**
 * The texts a community gives its members to read on one day. The office
 * types or pastes them (Seb, 30 Sep 2026): official liturgical
 * translations are copyrighted per language, so INFUNION never fetches them.
 * The place's `readingsLinkUrl` points members to an official site instead.
 */
@Entity('daily_readings')
@Index(['poi', 'date'], { unique: true })
export class DailyReading {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Poi, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'poi_id' })
  poi!: Relation<Poi>;

  // The day it is for, YYYY-MM-DD. Members see it from midnight that day.
  @Column({ type: 'varchar', length: 10 })
  date!: string;

  // A few words from the priest or the office, shown above the readings.
  @Column('text', { nullable: true })
  word?: string | null;

  @Column('jsonb', { default: () => "'[]'" })
  sections!: ReadingSection[];

  // A draft stays in the admin; only published days reach the app.
  @Column({ default: false })
  published!: boolean;

  // "07:00": when members get a notification on the day, in the place's
  // time zone. Null sends none.
  @Column({ name: 'notify_at', type: 'varchar', length: 5, nullable: true })
  notifyAt?: string | null;

  @Column({ name: 'notified_at', type: 'timestamptz', nullable: true })
  notifiedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
