import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { Poi } from '../../pois/entities/poi.entity.js';
import { MemberMessage } from './member-message.entity.js';

/**
 * The one conversation between a place's office and one of its members
 * (the Messages module). Created by the first message, from either side.
 */
@Entity('member_conversations')
@Index(['poi', 'member'], { unique: true })
export class MemberConversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Poi, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'poi_id' })
  poi!: Relation<Poi>;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'member_id' })
  member!: Relation<User>;

  @OneToMany(() => MemberMessage, (message) => message.conversation)
  messages!: Relation<MemberMessage>[];

  @Column('timestamptz', { name: 'last_message_at' })
  lastMessageAt!: Date;

  // When each side last opened it: a message from the other side after
  // that is unread.
  @Column('timestamptz', { name: 'staff_seen_at', nullable: true })
  staffSeenAt?: Date | null;

  @Column('timestamptz', { name: 'member_seen_at', nullable: true })
  memberSeenAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
