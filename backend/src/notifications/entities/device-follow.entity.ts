import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { Poi } from '../../pois/entities/poi.entity.js';
import { PushToken } from './push-token.entity.js';

/**
 * A community followed from a phone used without an account (Seb, 9 Nov
 * 2026): the account-free twin of a membership's notification switches.
 * Nobody is behind it but the phone, so the community's team never sees
 * it; it goes when the phone stops taking notifications, and turns into
 * nothing once the phone signs in (the person's memberships take over).
 *
 * Only what a guest can receive: news, event reminders, live streams and
 * daily readings. Requests and messages need an account.
 */
@Entity('device_follows')
@Index('IDX_device_follows_token_poi', ['pushToken', 'poi'], { unique: true })
@Index('IDX_device_follows_poi', ['poi'])
export class DeviceFollow {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => PushToken, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'push_token_id' })
  pushToken!: Relation<PushToken>;

  @ManyToOne(() => Poi, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'poi_id' })
  poi!: Relation<Poi>;

  @Column({ name: 'notify_news', default: true })
  notifyNews!: boolean;

  @Column({ name: 'notify_events', default: true })
  notifyEvents!: boolean;

  @Column({ name: 'notify_live', default: true })
  notifyLive!: boolean;

  @Column({ name: 'notify_readings', default: true })
  notifyReadings!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
