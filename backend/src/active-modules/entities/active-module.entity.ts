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
import { ModuleType } from '../../common/enums/module-type.enum.js';
import { ModuleStatus } from '../../common/enums/module-status.enum.js';

/**
 * A product module (e.g. donations, events) subscribed to by a POI,
 * with its own subscription status/expiration date.
 */
@Entity('active_modules')
@Index(['poi', 'moduleType'], { unique: true })
export class ActiveModule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Poi, (poi) => poi.activeModules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'poi_id' })
  poi!: Relation<Poi>;

  @Column({ name: 'module_type', type: 'enum', enum: ModuleType })
  moduleType!: ModuleType;

  @Column({
    type: 'enum',
    enum: ModuleStatus,
    default: ModuleStatus.TRIAL,
  })
  status!: ModuleStatus;

  @Column({ name: 'start_date', type: 'timestamptz', default: () => 'now()' })
  startDate!: Date;

  @Column({ name: 'expiration_date', type: 'timestamptz', nullable: true })
  expirationDate?: Date | null;

  // The free month: set once, when the trial starts. A module that has a
  // row has had its trial, whatever its status now.
  @Column({ name: 'trial_ends_at', type: 'timestamptz', nullable: true })
  trialEndsAt?: Date | null;

  // Paid up to here; renews on the community's billing date.
  @Column({ name: 'paid_until', type: 'timestamptz', nullable: true })
  paidUntil?: Date | null;

  // Stopped by the office: stays on until paidUntil, then switches off.
  @Column({ name: 'cancel_at_period_end', default: false })
  cancelAtPeriodEnd!: boolean;

  // Given by INFUNION (superadmin, Seb 17 Oct 2026): on, never billed, never
  // expires, like a whole community's billingComped but for one module.
  @Column({ default: false })
  offered!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
