import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

/**
 * "Hide everything from <name>": one member no longer sees another's posts,
 * replies and prayer requests, in every community. Only the member who
 * hides knows; the other person isn't told.
 */
@Entity('hidden_people')
@Unique('UQ_hidden_people_pair', ['user', 'hidden'])
export class HiddenPerson {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hidden_id' })
  hidden!: Relation<User>;

  // The name as it was shown, for Profile › Hidden people.
  @Column({ name: 'hidden_name', type: 'varchar', nullable: true })
  hiddenName!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
