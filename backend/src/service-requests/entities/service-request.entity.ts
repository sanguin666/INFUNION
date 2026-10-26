import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Poi } from '../../pois/entities/poi.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { ServiceRequestMessage } from './service-request-message.entity.js';
import { ServiceRequestDocument } from './service-request-document.entity.js';

/** What a member is asking the community for. */
export enum ServiceRequestType {
  BAPTISM = 'baptism',
  WEDDING = 'wedding',
  FUNERAL = 'funeral',
  FIRST_COMMUNION = 'first_communion',
  CONFIRMATION = 'confirmation',
  // A copy of a sacrament certificate — the baptism certificate a wedding
  // or a godparent needs is the one asked for most.
  CERTIFICATE = 'certificate',
  MEETING = 'meeting',
  BLESSING = 'blessing',
  SICK_VISIT = 'sick_visit',
  // Signing up for an activity: what associations ask for most.
  REGISTRATION = 'registration',
  OTHER = 'other',
}

/**
 * Where a request stands, as the member sees it. Documents still to send
 * are not a status of their own: they show from the request's documents,
 * so asking for a paper never hides that an appointment is already set.
 */
export enum ServiceRequestStatus {
  RECEIVED = 'received',
  IN_PROGRESS = 'in_progress',
  APPOINTMENT_SET = 'appointment_set',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

/**
 * One thing a member asked the community for, followed from the first
 * message to the end: its status, an appointment, the documents staff
 * asked for, and the conversation between the two sides.
 */
@Entity('service_requests')
export class ServiceRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Poi, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'poi_id' })
  poi!: Relation<Poi>;

  // Always someone signed in: a request is a conversation, and the member
  // has to be able to come back to it and read the answer.
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requester_id' })
  requester!: Relation<User>;

  @Column({ type: 'enum', enum: ServiceRequestType })
  type!: ServiceRequestType;

  @Column({ type: 'enum', enum: ServiceRequestStatus, default: ServiceRequestStatus.RECEIVED })
  status!: ServiceRequestStatus;

  // Who staff should ask for — often not the account holder (a parent
  // asking for a child's baptism, a son arranging a funeral).
  @Column({ name: 'contact_name' })
  contactName!: string;

  @Column('varchar', { name: 'contact_phone', nullable: true })
  contactPhone?: string | null;

  // What the member wrote when asking: names, dates, anything useful.
  @Column('text')
  details!: string;

  // When the family would like it, in their own words ("a Sunday in
  // November", "before the 12th"): a wish, not an appointment, and
  // families rarely have one exact day in mind.
  @Column('varchar', { name: 'preferred_date', nullable: true })
  preferredDate?: string | null;

  @Column('timestamptz', { name: 'appointment_at', nullable: true })
  appointmentAt?: Date | null;

  @Column('varchar', { name: 'appointment_place', nullable: true })
  appointmentPlace?: string | null;

  // Two pairs of timestamps drive the "new" dots on each side: something
  // is unread for staff when the member acted after staff last opened the
  // request, and the other way round.
  @Column('timestamptz', { name: 'last_member_activity_at', nullable: true })
  lastMemberActivityAt?: Date | null;

  @Column('timestamptz', { name: 'last_staff_activity_at', nullable: true })
  lastStaffActivityAt?: Date | null;

  @Column('timestamptz', { name: 'member_seen_at', nullable: true })
  memberSeenAt?: Date | null;

  @Column('timestamptz', { name: 'staff_seen_at', nullable: true })
  staffSeenAt?: Date | null;

  @OneToMany(() => ServiceRequestMessage, (message) => message.request)
  messages!: Relation<ServiceRequestMessage>[];

  @OneToMany(() => ServiceRequestDocument, (document) => document.request)
  documents!: Relation<ServiceRequestDocument>[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
