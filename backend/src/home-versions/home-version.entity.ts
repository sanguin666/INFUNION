import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { Poi } from '../pois/entities/poi.entity.js';

/** A page section as kept in a version. */
export type VersionBlock = {
  id: string;
  type: string;
  position: number;
  title: string | null;
  body: string | null;
  imageUrl: string | null;
  itemCount: number;
};

/** A badge as kept in a version. */
export type VersionBadge = {
  id: string;
  kind: string;
  position: number;
  enabled: boolean;
  text: string | null;
  important: boolean;
  linkModule: string | null;
  campaignId: string | null;
  showUntil: string | null;
};

/**
 * A saved home page (Seb, 9 Nov 2026, #194): its sections and badges, to
 * put back live later (a Christmas page, a campaign). Up to five per
 * community; `live` marks the one the page was last switched to or saved
 * as, `auto` the copies kept on their own before a switch.
 */
@Entity('home_page_versions')
@Index('IDX_home_page_versions_poi', ['poiId'])
export class HomePageVersion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'poi_id' })
  poiId!: string;

  @ManyToOne(() => Poi, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'poi_id', foreignKeyConstraintName: 'FK_home_page_versions_poi' })
  poi?: Relation<Poi>;

  @Column('varchar', { length: 60 })
  name!: string;

  @Column({ default: false })
  auto!: boolean;

  @Column({ default: false })
  live!: boolean;

  @Column('jsonb')
  blocks!: VersionBlock[];

  @Column('jsonb')
  badges!: VersionBadge[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
