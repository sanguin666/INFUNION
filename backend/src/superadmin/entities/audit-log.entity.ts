import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * The superadmin's Journal (Seb, 17 Oct 2026): every superadmin action,
 * every admin sign-in (and failed attempt), and every change the superadmin
 * makes inside a community's own admin. Plain ids and names rather than
 * relations, so a line outlives the account or community it names.
 */
@Entity('audit_log')
@Index(['createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  // e.g. "superadmin.poi.create", "admin.login.failed"
  @Column('varchar')
  action!: string;

  @Column('uuid', { name: 'actor_id', nullable: true })
  actorId?: string | null;

  @Column('varchar', { name: 'actor_email', nullable: true })
  actorEmail?: string | null;

  @Column('uuid', { name: 'poi_id', nullable: true })
  poiId?: string | null;

  @Column('varchar', { name: 'poi_name', nullable: true })
  poiName?: string | null;

  @Column('jsonb', { default: () => "'{}'" })
  details!: Record<string, unknown>;

  @Column('varchar', { nullable: true })
  ip?: string | null;
}
