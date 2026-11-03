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

export const REPORT_KINDS = ['post', 'comment', 'prayer'] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const REPORT_REASONS = [
  'spam',
  'hateful',
  'harassment',
  'inappropriate',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export type ReportStatus = 'open' | 'removed' | 'kept';

/**
 * A member reporting a post, a reply or a prayer request to the team
 * (Apple guideline 1.2, Seb, 3 Nov 2026). The words and the author are
 * copied in, so the team still sees what was reported after it is removed.
 */
@Entity('content_reports')
@Index('IDX_content_reports_poi_status', ['poi', 'status'])
@Index('IDX_content_reports_target', ['kind', 'targetId'])
export class ContentReport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Poi, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'poi_id' })
  poi!: Relation<Poi>;

  @Column({ type: 'varchar', length: 16 })
  kind!: ReportKind;

  @Column({ name: 'target_id', type: 'uuid' })
  targetId!: string;

  // For a reply: the post it answers, so the team can open the thread.
  @Column({ name: 'post_id', type: 'uuid', nullable: true })
  postId!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reporter_id' })
  reporter!: Relation<User> | null;

  @Column({ type: 'varchar', length: 24 })
  reason!: ReportReason;

  @Column('text')
  excerpt!: string;

  @Column({ name: 'author_name', type: 'varchar', nullable: true })
  authorName!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'author_id' })
  author!: Relation<User> | null;

  @Column({ name: 'content_created_at', type: 'timestamptz', nullable: true })
  contentCreatedAt!: Date | null;

  @Column({ type: 'varchar', length: 16, default: 'open' })
  status!: ReportStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;
}
