import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { Poi } from '../../pois/entities/poi.entity.js';
import { User } from '../../users/entities/user.entity.js';

/**
 * Someone on a community's own list of members (Seb, 9 Nov 2026),
 * imported from a spreadsheet or added by hand. Until they sign in to the
 * app with the same email or phone, they are "not in the app yet": the
 * team can still write to them by email or WhatsApp, outside the app.
 * Once linked, `user` is their account and they are a member like any
 * other. A contact belongs to one community: the same person on two
 * communities' lists is two contacts.
 */
@Entity('contacts')
@Index('IDX_contacts_poi', ['poi'])
@Index('IDX_contacts_user', ['user'])
@Index('UQ_contacts_poi_email', ['poi', 'email'], { unique: true, where: '"email" IS NOT NULL' })
@Index('IDX_contacts_email', ['email'])
@Index('IDX_contacts_phone_key', ['phoneKey'])
export class Contact {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Poi, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'poi_id' })
  poi!: Relation<Poi>;

  @Column('varchar', { name: 'first_name', length: 80, nullable: true })
  firstName!: string | null;

  @Column('varchar', { name: 'last_name', length: 120, nullable: true })
  lastName!: string | null;

  // Lowercased; unique within the community (partial index in the migration).
  @Column('varchar', { length: 200, nullable: true })
  email!: string | null;

  // "+" and digits, as the app stores phones.
  @Column('varchar', { length: 20, nullable: true })
  phone!: string | null;

  // Its last nine digits: how the same phone written two ways is found.
  @Column('varchar', { name: 'phone_key', length: 9, nullable: true })
  phoneKey!: string | null;

  @Column('varchar', { length: 20, nullable: true })
  whatsapp!: string | null;

  @Column('varchar', { length: 64, nullable: true })
  telegram!: string | null;

  // The language to write to them in, when the list says; the
  // community's own language otherwise.
  @Column('varchar', { length: 2, nullable: true })
  language!: string | null;

  @Column('jsonb', { default: () => "'[]'" })
  groups!: string[];

  // Their app account once they signed in with this email or phone.
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User> | null;

  @Column({ name: 'linked_at', type: 'timestamptz', nullable: true })
  linkedAt!: Date | null;

  // A secret for the links in the messages they get: the invitation,
  // the contribution page and "stop these messages".
  @Column({ type: 'varchar', length: 32, unique: true })
  token!: string;

  @Column({ name: 'invited_at', type: 'timestamptz', nullable: true })
  invitedAt!: Date | null;

  @Column({ name: 'last_written_at', type: 'timestamptz', nullable: true })
  lastWrittenAt!: Date | null;

  // They asked to stop the community's messages (or their address
  // bounced): nothing is sent to them again.
  @Column({ name: 'unsubscribed_at', type: 'timestamptz', nullable: true })
  unsubscribedAt!: Date | null;

  // Where they came from, for the community's records (GDPR): the file
  // name and who imported it, or "added by hand".
  @Column('varchar', { length: 200, nullable: true })
  source!: string | null;

  @Column({ name: 'added_by', type: 'uuid', nullable: true })
  addedBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
