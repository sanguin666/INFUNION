import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Poi } from '../../pois/entities/poi.entity.js';
import { User } from '../../users/entities/user.entity.js';

/**
 * A prayer request shared with the POI's community. Anyone can add a
 * "praying" tap (prayerCount) without needing to be signed in yet.
 */
@Entity('prayer_requests')
@Index('IDX_prayer_requests_poi', ['poi'])
@Index('IDX_prayer_requests_author', ['author'])
export class PrayerRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Poi, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'poi_id' })
  poi!: Relation<Poi>;

  @Column({ name: 'author_name', nullable: true })
  authorName?: string;

  // Who posted it, when they were signed in. Nullable because rows created
  // before there was a congregant login have no author to point at.
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'author_id' })
  author?: Relation<User> | null;

  @Column('text')
  message!: string;

  @Column({ name: 'prayer_count', default: 0 })
  prayerCount!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
