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
import { LivestreamStatus } from '../../common/enums/livestream-status.enum.js';

/**
 * A livestreamed or recorded service, linking out to an external
 * platform (YouTube, Facebook, etc.) rather than hosting video itself.
 */
@Entity('livestreams')
@Index('IDX_livestreams_poi', ['poi'])
export class Livestream {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Poi, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'poi_id' })
  poi!: Relation<Poi>;

  @Column()
  title!: string;

  @Column()
  url!: string;

  @Column({ name: 'scheduled_at', type: 'timestamptz' })
  scheduledAt!: Date;

  @Column({
    type: 'enum',
    enum: LivestreamStatus,
    default: LivestreamStatus.UPCOMING,
  })
  status!: LivestreamStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
