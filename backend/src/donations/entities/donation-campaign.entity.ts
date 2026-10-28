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
import { Poi } from '../../pois/entities/poi.entity.js';

const money = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null) => (value === null ? null : Number.parseFloat(value)),
};

export type CampaignAllocationLine = { label: string; percent: number };

/**
 * A project a community raises money for — the roof, the organ, a
 * pilgrimage — with a goal the app shows progress towards. What has been
 * raised is never stored: it is the sum of the completed gifts pointing
 * at the campaign, so it can't drift from the gifts themselves.
 */
@Entity('donation_campaigns')
@Index('IDX_donation_campaigns_poi', ['poi'])
export class DonationCampaign {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Poi, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'poi_id' })
  poi!: Relation<Poi>;

  @Column()
  title!: string;

  @Column('text', { nullable: true })
  description?: string | null;

  // null: a campaign with no target, shown as what has been raised so far.
  @Column('numeric', { name: 'goal_amount', precision: 10, scale: 2, nullable: true, transformer: money })
  goalAmount?: number | null;

  @Column('timestamptz', { name: 'ends_at', nullable: true })
  endsAt?: Date | null;

  // A picture of what the money is for, shown on the project's page
  // (a path under /uploads, like every other uploaded image).
  @Column('varchar', { name: 'image_url', nullable: true })
  imageUrl?: string | null;

  // Where the money goes, as the office tells it: up to eight lines whose
  // shares add up to 100 (the roof 70 %, the gutters 30 %). Shown on the
  // project's page in the app; null when the office hasn't said.
  @Column('jsonb', { nullable: true })
  allocation?: CampaignAllocationLine[] | null;

  // Off: hidden from the app, still listed (with its gifts) in the dashboard.
  @Column({ default: true })
  active!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
