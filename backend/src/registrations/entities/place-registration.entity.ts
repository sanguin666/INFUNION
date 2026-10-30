import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { BillingInterval } from '../../common/enums/billing-interval.enum.js';
import { Language } from '../../common/enums/language.enum.js';
import { PlanTier } from '../../common/enums/plan-tier.enum.js';
import { PoiType } from '../../common/enums/poi-type.enum.js';
import { RegistrationStatus } from '../registration-rules.js';

/**
 * A place asking to join infunion from the landing's form (Seb, 30 Oct
 * 2026). Nothing exists for it yet: no place, no pin, no QR code, no
 * admin. Only the superadmin's Approve turns it into a place. Plain
 * columns rather than relations, so a request outlives what it names.
 */
@Entity('place_registrations')
@Index(['status', 'createdAt'])
export class PlaceRegistration {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ type: 'varchar', default: RegistrationStatus.PENDING })
  status!: RegistrationStatus;

  // ---- the place

  @Column({ name: 'place_name' })
  placeName!: string;

  @Column({ type: 'varchar' })
  type!: PoiType;

  @Column()
  address!: string;

  @Column({ name: 'postal_code' })
  postalCode!: string;

  @Column()
  city!: string;

  // ISO 3166 alpha-2, e.g. ES.
  @Column({ type: 'varchar', length: 2 })
  country!: string;

  @Column({ type: 'varchar' })
  language!: Language;

  @Column('varchar', { nullable: true })
  website?: string | null;

  @Column({ name: 'legal_name' })
  legalName!: string;

  // Normalized: upper case, no spaces or punctuation.
  @Index()
  @Column({ name: 'tax_id' })
  taxId!: string;

  // Stored path in the private area (`registrations/<file>`) and the name it was sent with.
  @Column('varchar', { name: 'document_path', nullable: true })
  documentPath?: string | null;

  @Column('varchar', { name: 'document_name', nullable: true })
  documentName?: string | null;

  // "Ask to manage it": the place already on infunion this person wants to run.
  @Column('uuid', { name: 'existing_poi_id', nullable: true })
  existingPoiId?: string | null;

  // ---- the person

  @Column({ name: 'first_name' })
  firstName!: string;

  @Column({ name: 'last_name' })
  lastName!: string;

  @Column()
  role!: string;

  // Confirmed by a code before the request could be sent.
  @Index()
  @Column()
  email!: string;

  @Column('varchar', { nullable: true })
  phone?: string | null;

  // ---- plan and agreement

  @Column({ type: 'varchar', default: PlanTier.BASIC })
  plan!: PlanTier;

  @Column({ name: 'billing_interval', type: 'varchar', default: BillingInterval.MONTHLY })
  billingInterval!: BillingInterval;

  @Column({ name: 'terms_version' })
  termsVersion!: string;

  @Column({ name: 'dpa_version' })
  dpaVersion!: string;

  // Worship places also agree to how members' religious data is handled.
  @Column({ name: 'religious_data_agreed', default: false })
  religiousDataAgreed!: boolean;

  @Column({ name: 'signed_name' })
  signedName!: string;

  @Column({ name: 'signed_at', type: 'timestamptz' })
  signedAt!: Date;

  @Index()
  @Column('varchar', { nullable: true })
  ip?: string | null;

  @Column('varchar', { name: 'user_agent', nullable: true })
  userAgent?: string | null;

  // ---- the superadmin's side

  @Column({ name: 'document_checked_at', type: 'timestamptz', nullable: true })
  documentCheckedAt?: Date | null;

  // The last question sent, and when.
  @Column('text', { nullable: true })
  question?: string | null;

  @Column({ name: 'questioned_at', type: 'timestamptz', nullable: true })
  questionedAt?: Date | null;

  @Column('text', { name: 'decline_reason', nullable: true })
  declineReason?: string | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt?: Date | null;

  @Column('varchar', { name: 'decided_by', nullable: true })
  decidedBy?: string | null;

  // The place Approve created (or the existing one it linked).
  @Column('uuid', { name: 'poi_id', nullable: true })
  poiId?: string | null;

  // The 14-day withdrawal (TRLGDCU art. 102: a non-profit is a consumer).
  @Column({ name: 'withdrawn_at', type: 'timestamptz', nullable: true })
  withdrawnAt?: Date | null;

  @Column('text', { name: 'withdraw_reason', nullable: true })
  withdrawReason?: string | null;
}
