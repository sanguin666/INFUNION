import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { MemberConversation } from './member-conversation.entity.js';

/** One message in a conversation between the office and a member. */
@Entity('member_messages')
@Index('IDX_member_messages_conversation', ['conversation'])
@Index('IDX_member_messages_author', ['author'])
export class MemberMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => MemberConversation, (conversation) => conversation.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation!: Relation<MemberConversation>;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'author_id' })
  author?: Relation<User> | null;

  // Which side wrote it, kept on the row for the same reason as on a
  // request's messages: the author may stop being staff later.
  @Column({ name: 'from_staff', default: false })
  fromStaff!: boolean;

  @Column('text')
  body!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
