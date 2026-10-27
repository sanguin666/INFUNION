import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Failed attempts per key (an admin's email, the superadmin account), kept
 * in the database rather than in memory so that every copy of the API
 * counts the same attempts: with three copies, an in-memory count would
 * give a guesser three times the tries. Also the shared clock for the
 * public geocoder's one-request-a-second rule.
 */
@Entity('rate_limits')
export class RateLimit {
  // `<scope>:<key>`, e.g. `admin-login:office@example.org`.
  @PrimaryColumn('varchar', { length: 300 })
  key!: string;

  @Column('int', { default: 0 })
  count!: number;

  @Column('timestamptz', { name: 'first_at' })
  firstAt!: Date;

  @Column('timestamptz', { name: 'locked_until', nullable: true })
  lockedUntil?: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
