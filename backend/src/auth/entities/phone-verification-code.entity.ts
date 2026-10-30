import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * One login code sent to one phone number (by SMS) or one email address.
 * Exactly one of `phone` and `email` is set. Kept in the database rather
 * than in memory so a code stays valid across a backend restart (a dev
 * running `start:dev` restarts on every save) and so several backend
 * instances would agree on it later.
 *
 * Only a hash of the code is stored: a leaked database row should not let
 * anyone log in as that phone number.
 */
@Entity('phone_verification_codes')
export class PhoneVerificationCode {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Normalized to digits with an optional leading `+` — see
  // phone-auth.service.ts, which normalizes before both writing and reading
  // so "+34 600 00 00 00" and "+34600000000" are the same person.
  @Index()
  @Column({ type: 'varchar', nullable: true })
  phone?: string | null;

  // Trimmed and lower-cased, for the same reason (see normalizeEmail).
  @Index()
  @Column({ type: 'varchar', nullable: true })
  email?: string | null;

  @Column({ name: 'code_hash' })
  codeHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  // Counts wrong guesses against this code, so a 6-digit code can't be
  // brute-forced within its lifetime.
  @Column({ default: 0 })
  attempts!: number;

  // Set the moment the code is accepted: a code works exactly once, even
  // if someone replays the same request.
  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
