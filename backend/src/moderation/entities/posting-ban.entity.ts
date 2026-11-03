import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Poi } from '../../pois/entities/poi.entity.js';
import { User } from '../../users/entities/user.entity.js';

/**
 * The team's "Remove and block from posting": the member still uses the
 * app, but can no longer post, reply or share a prayer request in this
 * community.
 */
@Entity('posting_bans')
@Unique('UQ_posting_bans_pair', ['poi', 'user'])
export class PostingBan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Poi, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'poi_id' })
  poi!: Relation<Poi>;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
