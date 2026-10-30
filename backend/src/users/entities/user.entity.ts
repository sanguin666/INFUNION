import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { UserPoi } from '../../user-pois/entities/user-poi.entity.js';
import { Language } from '../../common/enums/language.enum.js';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Login identifier for members: phone number + SMS code. Nullable
  // because admins, and members who sign in by email, don't have one.
  @Column({ unique: true, nullable: true })
  phone?: string;

  // Login identifier for POI admins (email + password, the admin
  // dashboard) and for members who sign in with an email code. Nullable
  // because members who sign in by phone don't have one.
  @Column({ unique: true, nullable: true })
  email?: string;

  // `select: false` so the hash is left out of every query that doesn't
  // ask for it by name. Without it, any endpoint returning a User — or a
  // relation that loads one — hands out the parish admin's password hash.
  // Only UsersService.findByEmailForLogin selects it.
  @Column({ name: 'password_hash', nullable: true, select: false })
  passwordHash?: string;

  @Column({ name: 'first_name', nullable: true })
  firstName?: string;

  @Column({ name: 'last_name', nullable: true })
  lastName?: string;

  // Relative path (e.g. /uploads/avatars/<file>.jpg) to the picture this
  // person chose for themselves, served statically like every other
  // upload. Nullable because most people never set one — the app draws
  // their initials instead.
  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl?: string;

  // The place this person was in last, so the app can reopen it instead
  // of asking again. Deliberately a plain id rather than a relation: a
  // foreign key back to Poi would close a circle through UserPoi, and a
  // place that disappears should leave someone with a stale id the app
  // quietly falls back from, not a failed delete.
  @Column({ name: 'last_active_poi_id', type: 'uuid', nullable: true })
  lastActivePoiId?: string;

  // UI language for this user's own account. Meaningful today for admins
  // (who have a real session) — the admin dashboard reads/writes it.
  // Congregant users don't have a session yet, so the app's language
  // switcher is a device-local preference instead; this column is here so
  // it becomes real once congregant login exists.
  @Column({ type: 'enum', enum: Language, default: Language.EN })
  language!: Language;

  // infunion's own superadmin (Seb, 17 Oct 2026). Never set from the API:
  // SuperadminBootstrap writes it on boot for the one address named by
  // SUPERADMIN_EMAIL and clears it everywhere else, and every superadmin
  // check also compares the email against that variable.
  @Column({ name: 'is_superadmin', default: false })
  isSuperadmin!: boolean;

  // The superadmin's authenticator app secret, encrypted (see
  // superadmin/secret-box.ts). The pending one is the secret being set up,
  // kept apart until a first code proves the phone has it.
  @Column({ name: 'totp_secret', type: 'text', nullable: true, select: false })
  totpSecret?: string | null;

  @Column({ name: 'totp_pending_secret', type: 'text', nullable: true, select: false })
  totpPendingSecret?: string | null;

  // The 30-second step of the last code accepted, so a code is good once.
  @Column({ name: 'totp_last_step', type: 'bigint', nullable: true, select: false })
  totpLastStep?: string | null;

  // Last time this account used the API, written at most once an hour
  // (JwtAuthGuard). Feeds "members active over 30 days" in the superadmin.
  @Column({ name: 'last_seen_at', type: 'timestamptz', nullable: true })
  lastSeenAt?: Date | null;

  // Last successful email + password sign-in (admins only).
  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt?: Date | null;

  // Which version of the terms of use and privacy policy this person
  // accepted in the app, and when (GDPR art. 7: consent has to be provable).
  // The app asks again whenever CONSENT_VERSION moves past this one.
  // Accepting also confirms the person is 14 or older (LOPDGDD art. 7).
  @Column({ name: 'consent_version', type: 'varchar', nullable: true })
  consentVersion?: string | null;

  @Column({ name: 'consented_at', type: 'timestamptz', nullable: true })
  consentedAt?: Date | null;

  @OneToMany(() => UserPoi, (membership) => membership.user)
  pois!: Relation<UserPoi>[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
