import {
  BeforeInsert,
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
import { DonationCampaign } from './donation-campaign.entity.js';
import { donationFee } from '../platform-fee.js';

/**
 * Where a gift is in the payment flow. A gift made through Stripe starts
 * PENDING and only becomes COMPLETED once Stripe confirms the payment, so
 * an abandoned checkout never shows up in the parish's totals.
 */
export enum DonationStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * What a gift is for. A Mass intention's offering is a gift too, so it
 * goes through the same payment flow and shows in the same totals, but it
 * can only be made through the Mass intentions module, never chosen by
 * hand on the donate screen.
 */
export enum DonationPurpose {
  GENERAL = 'general',
  // The collection taken at Mass, given from the pew with a phone.
  COLLECTION = 'collection',
  CAMPAIGN = 'campaign',
  MASS_INTENTION = 'mass_intention',
}

/**
 * A single gift to a POI. Gifts go through Stripe Checkout when the backend
 * has a Stripe key configured (see donations/stripe.service.ts); without one
 * the app falls back to the demo flow, which records the amount without
 * moving any money so the admin dashboard's graph still has data to show.
 */
@Entity('donations')
@Index('IDX_donations_poi', ['poi'])
@Index('IDX_donations_campaign', ['campaign'])
@Index('IDX_donations_donor', ['donor'])
export class Donation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Poi, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'poi_id' })
  poi!: Relation<Poi>;

  // Stored as numeric so Postgres keeps exact cents; the pg driver returns
  // numeric columns as strings, so a transformer parses it back to a number.
  @Column('numeric', {
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number.parseFloat(value),
    },
  })
  amount!: number;

  // ISO 4217, lowercase to match Stripe's own representation.
  @Column({ default: 'eur' })
  currency!: string;

  // Defaults to COMPLETED so demo-flow gifts and rows seeded before Stripe
  // existed keep counting towards the totals; the Stripe flow sets PENDING
  // explicitly and promotes the row once the payment confirms.
  @Column({ type: 'varchar', default: DonationStatus.COMPLETED })
  status!: DonationStatus;

  @Column({ name: 'stripe_session_id', nullable: true })
  stripeSessionId?: string;

  @Column({ name: 'stripe_payment_intent_id', nullable: true })
  stripePaymentIntentId?: string;

  @Column({ name: 'donor_name', nullable: true })
  donorName?: string;

  @Column({ type: 'enum', enum: DonationPurpose, default: DonationPurpose.GENERAL })
  purpose!: DonationPurpose;

  // The project a campaign gift went to. A campaign that is deleted keeps
  // its gifts, which simply stop being counted towards a goal.
  @ManyToOne(() => DonationCampaign, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'campaign_id' })
  campaign?: Relation<DonationCampaign> | null;

  // Who gave, when they were signed in. Needed for a monthly gift (so the
  // giver can stop it) and for "my tax receipt"; optional otherwise.
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'donor_id' })
  donor?: Relation<User> | null;

  // A monthly gift. The row that started it has no parent; each later
  // month Stripe charges is a row of its own pointing back at it, so every
  // payment still lands on the day it was made in the totals.
  @Column({ default: false })
  recurring!: boolean;

  @Column('uuid', { name: 'recurring_parent_id', nullable: true })
  recurringParentId?: string | null;

  @Column('varchar', { name: 'stripe_subscription_id', nullable: true })
  stripeSubscriptionId?: string | null;

  // The Stripe invoice a later month's row was recorded from, so the same
  // invoice arriving twice (Stripe retries webhooks) is recorded once.
  @Column('varchar', { name: 'stripe_invoice_id', nullable: true, unique: true })
  stripeInvoiceId?: string | null;

  @Column('timestamptz', { name: 'recurring_cancelled_at', nullable: true })
  recurringCancelledAt?: Date | null;

  // A tax receipt needs to know who the giver is and where they live
  // (and in Spain, their NIF). Asked only when the giver wants a receipt,
  // and kept on the gift as given, as the receipt has to say.
  @Column({ name: 'wants_receipt', default: false })
  wantsReceipt!: boolean;

  @Column('varchar', { name: 'donor_address', nullable: true })
  donorAddress?: string | null;

  @Column('varchar', { name: 'donor_postal_code', nullable: true })
  donorPostalCode?: string | null;

  @Column('varchar', { name: 'donor_city', nullable: true })
  donorCity?: string | null;

  @Column('varchar', { name: 'donor_tax_id', nullable: true })
  donorTaxId?: string | null;

  // infunion's share of the gift (see platform-fee.ts), fixed when the gift
  // is recorded so a later change of rate leaves past gifts as they were.
  @Column('numeric', {
    name: 'platform_fee',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number.parseFloat(value),
    },
  })
  platformFee!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @BeforeInsert()
  setPlatformFee() {
    if (this.platformFee === undefined || this.platformFee === null) {
      this.platformFee = donationFee(Number(this.amount) || 0);
    }
  }
}
