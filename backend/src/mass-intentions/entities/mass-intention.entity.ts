import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { Poi } from '../../pois/entities/poi.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { Donation } from '../../donations/entities/donation.entity.js';

export enum MassIntentionStatus {
  // Waiting for the offering to go through on Stripe.
  PENDING_PAYMENT = 'pending_payment',
  // Paid (or free) and on the list for its celebration.
  CONFIRMED = 'confirmed',
  // The office ticked it off once the Mass was said.
  CELEBRATED = 'celebrated',
  CANCELLED = 'cancelled',
}

/**
 * A Mass said for someone: "for Jean Dupont, who died last month". Asked
 * for from the app with the community's offering, or written in at the
 * office, and listed by celebration for the priest to read out.
 */
@Entity('mass_intentions')
@Index('IDX_mass_intentions_poi', ['poi'])
@Index('IDX_mass_intentions_requester', ['requester'])
@Index('IDX_mass_intentions_donation', ['donation'])
export class MassIntention {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Poi, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'poi_id' })
  poi!: Relation<Poi>;

  // What is read out, as the family wrote it.
  @Column('text')
  intention!: string;

  @Column({ name: 'requester_name' })
  requesterName!: string;

  // A phone number or an email, so the office can call back if the date
  // doesn't work. Optional: the signed-in account already gives a phone.
  @Column('varchar', { name: 'requester_contact', nullable: true })
  requesterContact?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'requester_id' })
  requester?: Relation<User> | null;

  // The celebration asked for, or null for "whenever the community can".
  @Column('timestamptz', { name: 'celebration_at', nullable: true })
  celebrationAt?: Date | null;

  // Which event that was, and its title at the time. A plain id rather
  // than a relation: deleting an event must not delete the intentions
  // already said for it.
  @Column('uuid', { name: 'event_id', nullable: true })
  eventId?: string | null;

  @Column('varchar', { name: 'celebration_title', nullable: true })
  celebrationTitle?: string | null;

  @Column('numeric', {
    name: 'offering_amount',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number | null | undefined) => value,
      from: (value: string | null) => (value === null ? null : Number.parseFloat(value)),
    },
  })
  offeringAmount?: number | null;

  // The gift that paid the offering online. None for an intention taken
  // at the office, or one made with no offering.
  @ManyToOne(() => Donation, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'donation_id' })
  donation?: Relation<Donation> | null;

  @Column({ type: 'enum', enum: MassIntentionStatus, default: MassIntentionStatus.CONFIRMED })
  status!: MassIntentionStatus;

  // Written in at the office rather than asked for from the app.
  @Column({ name: 'from_office', default: false })
  fromOffice!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
