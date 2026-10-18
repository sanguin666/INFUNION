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
import { ActiveModule } from '../../active-modules/entities/active-module.entity.js';
import { PoiType } from '../../common/enums/poi-type.enum.js';
import { Language } from '../../common/enums/language.enum.js';
import { BillingInterval } from '../../common/enums/billing-interval.enum.js';
import { ModuleType } from '../../common/enums/module-type.enum.js';

/**
 * A point of interest a user can join: a church today, potentially other
 * kinds of venues/organizations later (the product started with churches,
 * hence "POI" rather than a narrower name).
 */
@Entity('pois')
export class Poi {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  // Drives the app's visual theme (accent color, imagery, wording).
  @Column({ type: 'enum', enum: PoiType, default: PoiType.CHURCH })
  type!: PoiType;

  // The language this POI publishes content in (announcements, events,
  // etc.) — not translated for readers yet, just tagged, since there's no
  // translation service wired up. The app's own menus translate separately
  // based on the reader's own language (see the `language` column on User).
  @Column({ type: 'enum', enum: Language, default: Language.EN })
  language!: Language;

  // Shown on the POI's hub screen in the app and on its onboarding flyer.
  @Column('text', { nullable: true })
  description?: string;

  // A URL to a logo/photo for the POI — pasted in by the admin for now
  // rather than uploaded (the upload pipeline used for announcement voice
  // messages could be reused for direct uploads later).
  @Column({ name: 'picture_url', nullable: true })
  pictureUrl?: string;

  // Editable text for the printable onboarding flyer generated on the
  // admin dashboard's "My QR" page — left blank to fall back to a
  // sensible default there.
  @Column({ name: 'qr_flyer_headline', nullable: true })
  qrFlyerHeadline?: string;

  @Column('text', { name: 'qr_flyer_subtext', nullable: true })
  qrFlyerSubtext?: string;

  // The order this POI wants its modules to appear in the app's bottom
  // menu: the first few get a button of their own, the rest fall under
  // More. Modules left out keep their default position at the end, so an
  // empty list simply means "whatever the app defaults to".
  @Column('text', { name: 'menu_order', array: true, default: () => "'{}'" })
  menuOrder!: ModuleType[];

  // What a Mass intention costs here, as the diocese sets it. null lets
  // the person asking choose what to give (or nothing).
  @Column('numeric', {
    name: 'mass_intention_offering',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number | null | undefined) => value,
      from: (value: string | null) => (value === null ? null : Number.parseFloat(value)),
    },
  })
  massIntentionOffering?: number | null;

  // Lectures du jour: an official site for the day's readings, shown as a
  // button under what the office wrote. `{date}` becomes YYYY-MM-DD.
  @Column({ name: 'readings_link_url', type: 'varchar', nullable: true })
  readingsLinkUrl?: string | null;

  // Who issues the tax receipts: the legal body behind the community (in
  // France the diocesan association, in Spain the parish or diocese with
  // its own CIF), which is rarely the name people know the place by.
  @Column('varchar', { name: 'legal_name', nullable: true })
  legalName?: string | null;

  @Column('varchar', { name: 'legal_tax_id', nullable: true })
  legalTaxId?: string | null;

  @Column('text', { name: 'legal_address', nullable: true })
  legalAddress?: string | null;

  @Column('varchar', { name: 'receipt_signatory', nullable: true })
  receiptSignatory?: string | null;

  // ---- Module billing (Seb, 30 Sep 2026) ----
  // Monthly or yearly, one choice for every paid module, so one bill.
  @Column({ name: 'billing_interval', type: 'enum', enum: BillingInterval, default: BillingInterval.MONTHLY })
  billingInterval!: BillingInterval;

  // "Offert": every module on at no charge. Set on the communities that
  // existed before billing, the demos among them; only ANSAE sets it.
  @Column({ name: 'billing_comped', default: false })
  billingComped!: boolean;

  // How the community pays, as shown back to it ("Prélèvement SEPA ·
  // •••• 4521"). Demo stage: nothing is charged, so only the label is kept.
  @Column('varchar', { name: 'payment_method_label', nullable: true })
  paymentMethodLabel?: string | null;

  // The one date every paid module renews on. null while nothing is paid.
  @Column({ name: 'billing_renews_at', type: 'timestamptz', nullable: true })
  billingRenewsAt?: Date | null;

  // Set by the superadmin: the community's admins are locked out, it no
  // longer shows in the directory and nobody new can join it. Nothing is
  // deleted; lifting the suspension brings everything back.
  @Column({ name: 'suspended_at', type: 'timestamptz', nullable: true })
  suspendedAt?: Date | null;

  @Column({ nullable: true })
  address?: string;

  @Column({ nullable: true })
  city?: string;

  @Column({ name: 'postal_code', nullable: true })
  postalCode?: string;

  // Where the place is, for the map of communities and "near you" (Seb,
  // 18 Oct 2026). Set from the admin: the address is looked up once with
  // OpenStreetMap's Nominatim, then the pin can be dragged. null until
  // then, and a place without coordinates is simply left off the map.
  @Column('double precision', { nullable: true })
  latitude?: number | null;

  @Column('double precision', { nullable: true })
  longitude?: number | null;

  // Whether the place shows on the map and in "near you" for people who
  // are not members yet. On by default; the community can turn it off.
  @Column({ name: 'map_visible', default: true })
  mapVisible!: boolean;

  // Unique token encoded in the QR code printed on the flyer displayed at
  // the POI's entrance, used for automatic onboarding of a user.
  @Column({ name: 'qr_code_token', unique: true })
  qrCodeToken!: string;

  @OneToMany(() => UserPoi, (membership) => membership.poi)
  members!: Relation<UserPoi>[];

  @OneToMany(() => ActiveModule, (activeModule) => activeModule.poi)
  activeModules!: Relation<ActiveModule>[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
