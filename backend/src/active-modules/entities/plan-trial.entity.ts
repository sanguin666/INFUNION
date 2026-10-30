import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { PlanTier } from '../../common/enums/plan-tier.enum.js';

/**
 * Every free month ever given (Seb, 30 Oct 2026: "the free trial works only
 * once"). Kept apart from the place, with no foreign key, so it outlives a
 * deleted place: the same organisation (tax ID) never gets a second free
 * month by registering again or by running two places.
 */
@Entity('plan_trials')
@Index(['taxId'])
export class PlanTrial {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn({ name: 'started_at', type: 'timestamptz' })
  startedAt!: Date;

  @Column('uuid', { name: 'poi_id', nullable: true })
  poiId?: string | null;

  @Column({ name: 'place_name' })
  placeName!: string;

  // Normalized ("G98765432"); null for a place with no legal details.
  @Column('varchar', { name: 'tax_id', nullable: true })
  taxId?: string | null;

  @Column({ type: 'varchar' })
  plan!: PlanTier;
}
