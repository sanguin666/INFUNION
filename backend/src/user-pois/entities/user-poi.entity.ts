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
import { User } from '../../users/entities/user.entity.js';
import { Poi } from '../../pois/entities/poi.entity.js';
import { MemberRole } from '../../common/enums/member-role.enum.js';

/**
 * Many-to-many join table between `users` and `pois`:
 * a user can belong to several POIs.
 */
@Entity('user_pois')
@Index(['user', 'poi'], { unique: true })
export class UserPoi {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, (user) => user.pois, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;

  @ManyToOne(() => Poi, (poi) => poi.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'poi_id' })
  poi!: Relation<Poi>;

  @Column({
    type: 'enum',
    enum: MemberRole,
    default: MemberRole.MEMBER,
  })
  role!: MemberRole;

  // Which push notifications this person wants from this place. All on by
  // default: someone who allowed notifications on their phone expects to
  // get them, and each kind can be turned off in the app's settings.
  @Column({ name: 'notify_news', default: true })
  notifyNews!: boolean;

  @Column({ name: 'notify_requests', default: true })
  notifyRequests!: boolean;

  @Column({ name: 'notify_events', default: true })
  notifyEvents!: boolean;

  @Column({ name: 'notify_live', default: true })
  notifyLive!: boolean;

  @Column({ name: 'notify_readings', default: true })
  notifyReadings!: boolean;

  @Column({ name: 'notify_messages', default: true })
  notifyMessages!: boolean;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt!: Date;
}
