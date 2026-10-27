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
import { BadgeKind } from '../../common/enums/badge-kind.enum.js';
import { ModuleType } from '../../common/enums/module-type.enum.js';

// A message has to fit a small tile on a phone.
export const MAX_BADGE_TEXT = 40;

/**
 * One of the small tiles at the very top of a place's home page. The
 * automatic kinds carry no text of their own; the app fills them in.
 */
@Entity('poi_badges')
@Index('IDX_poi_badges_poi', ['poi'])
export class PoiBadge {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Poi, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'poi_id' })
  poi!: Relation<Poi>;

  @Column({ type: 'enum', enum: BadgeKind })
  kind!: BadgeKind;

  @Column('int')
  position!: number;

  // Switched off rather than deleted, so an automatic badge can be put
  // back without being set up again.
  @Column({ default: true })
  enabled!: boolean;

  // A message's words. Empty for the automatic kinds.
  @Column('varchar', { length: MAX_BADGE_TEXT, nullable: true })
  text?: string | null;

  // A message shown in the strong orange: a closure, a change of time.
  @Column({ default: false })
  important!: boolean;

  // Which module a message opens when touched; none leaves it a notice.
  @Column({ name: 'link_module', type: 'enum', enum: ModuleType, nullable: true })
  linkModule?: ModuleType | null;

  // A campaign badge's campaign; none means the most recent open one.
  @Column('uuid', { name: 'campaign_id', nullable: true })
  campaignId?: string | null;

  // The last day a message shows, in the place's calendar. Past it the
  // badge stays in the dashboard, switched off in effect, until removed.
  @Column('date', { name: 'show_until', nullable: true })
  showUntil?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
