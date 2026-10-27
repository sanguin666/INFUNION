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
import { User } from '../../users/entities/user.entity.js';
import { Language } from '../../common/enums/language.enum.js';

/**
 * One phone that can receive push notifications for a person: the Expo push
 * token the app got from the operating system after the person allowed
 * notifications. Someone with a phone and a tablet has two rows.
 *
 * The token is unique on its own, not per user: a shared phone that signs
 * in as someone else hands its token over, so the previous person stops
 * receiving on a phone they no longer use.
 */
@Entity('push_tokens')
@Index('IDX_push_tokens_user', ['user'])
export class PushToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;

  @Column({ unique: true })
  token!: string;

  // The app's language and the phone's time zone when it last registered,
  // so a notification is written in the words and the clock its reader
  // sees in the app. Per phone rather than per person: the app keeps its
  // language on the device.
  @Column({ type: 'enum', enum: Language, default: Language.EN })
  language!: Language;

  @Column('varchar', { name: 'time_zone', nullable: true })
  timeZone?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  // Bumped each time the app registers the token again (every launch), so
  // tokens from phones nobody has opened in months can be told apart.
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
