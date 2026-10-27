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
import { CommunityPost } from './community-post.entity.js';
import { User } from '../../users/entities/user.entity.js';

@Entity('community_comments')
@Index('IDX_community_comments_post', ['post'])
@Index('IDX_community_comments_author', ['author'])
export class CommunityComment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => CommunityPost, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post!: Relation<CommunityPost>;

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
