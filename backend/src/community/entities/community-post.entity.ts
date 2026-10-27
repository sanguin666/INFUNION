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
 * A post on a POI's community board. Comments on it live in
 * CommunityComment — kept as a separate flat (non-nested) list rather than
 * a threaded tree, to keep moderation and the UI simple for now.
 */
@Entity('community_posts')
@Index('IDX_community_posts_poi', ['poi'])
@Index('IDX_community_posts_author', ['author'])
export class CommunityPost {
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

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
