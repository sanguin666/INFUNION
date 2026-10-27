import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { Event } from '../../events/entities/event.entity.js';

/**
 * Someone rang the bell on an event: they get a push an hour before it
 * starts, and for a repeating event (Sunday Mass) an hour before every
 * time, unless `onlyDate` limits it to one day. `remindedFor` is the
 * start the last push was for, so each time is reminded once.
 *
 * `nextCheckAt` is when the sweep next has to look at this bell (an hour
 * before its next time), so the every-minute sweep reads only the bells
 * due now instead of every repeating bell ever rung. Null means "work it
 * out on the next sweep": new bells, and bells whose event or whose
 * person's time zone just changed.
 */
@Entity('event_reminders')
@Index(['user', 'event'], { unique: true })
@Index('IDX_event_reminders_event', ['event'])
@Index('IDX_event_reminders_next_check_at', ['nextCheckAt'])
export class EventReminder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;

  @ManyToOne(() => Event, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'event_id' })
  event!: Relation<Event>;

  // YYYY-MM-DD in the place's time: a repeating event belled for one day.
  @Column('varchar', { name: 'only_date', length: 10, nullable: true })
  onlyDate?: string | null;

  @Column('timestamptz', { name: 'reminded_at', nullable: true })
  remindedAt?: Date | null;

  @Column('timestamptz', { name: 'reminded_for', nullable: true })
  remindedFor?: Date | null;

  @Column('timestamptz', { name: 'next_check_at', nullable: true })
  nextCheckAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
