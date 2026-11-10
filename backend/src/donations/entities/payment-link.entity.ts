import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { Poi } from '../../pois/entities/poi.entity.js';
import { DonationCampaign } from './donation-campaign.entity.js';

const money = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null) => (value === null ? null : Number.parseFloat(value)),
};

/**
 * A community's payment link (Seb, 10 Nov 2026): a short address and its
 * QR code that anyone opens to pay, with no app and no account — a
 * Christmas lunch at 15 € each, the bus to a pilgrimage, a project, or
 * simply "contribute". The money goes through the same Stripe checkout as
 * every other contribution, straight to the community's own account.
 * What a link has collected is never stored: it is the sum of the
 * completed gifts that carry its id.
 */
@Entity('payment_links')
@Index('IDX_payment_links_poi', ['poi'])
export class PaymentLink {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Poi, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'poi_id' })
  poi!: Relation<Poi>;

  // The short code in the address (/m/pay/K7Q2M): no 0/O or 1/I, so it
  // can be read out or typed from a poster.
  @Column('varchar', { length: 12, unique: true })
  code!: string;

  @Column('varchar', { length: 120 })
  title!: string;

  // Gifts go to this project when set, to general contributions otherwise.
  @ManyToOne(() => DonationCampaign, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'campaign_id' })
  campaign?: Relation<DonationCampaign> | null;

  // A few words to the payer under the title, in place of the usual
  // "Thank you for supporting your community." (Seb, 10 Nov 2026).
  @Column('varchar', { length: 300, nullable: true })
  message?: string | null;

  // A fixed amount (money sharing: 15 € each), or null for the payer's choice.
  @Column('numeric', { precision: 10, scale: 2, nullable: true, transformer: money })
  amount?: number | null;

  @Column({ name: 'ask_name', default: true })
  askName!: boolean;

  // The last day the link takes payments (inclusive), or null for always.
  @Column('date', { name: 'ends_on', nullable: true })
  endsOn?: string | null;

  // The community's own "Contribute" link, made for it and never removed.
  @Column({ name: 'is_default', default: false })
  isDefault!: boolean;

  // Removed links keep their gifts but no longer take payments.
  @Column('timestamptz', { name: 'archived_at', nullable: true })
  archivedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
