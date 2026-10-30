import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { BlockKind } from '../registration-rules.js';

/**
 * An email or tax ID that may not send registration requests any more:
 * "Decline and block" in the superadmin (Seb, 30 Oct 2026).
 */
@Entity('registration_blocks')
@Unique(['kind', 'value'])
export class RegistrationBlock {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'varchar' })
  kind!: BlockKind;

  @Column()
  value!: string;

  @Column('uuid', { name: 'registration_id', nullable: true })
  registrationId?: string | null;
}
