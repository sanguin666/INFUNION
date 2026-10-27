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
import { PageBlockType } from '../../common/enums/page-block-type.enum.js';

/**
 * One section of a POI's home page. Which of the columns below matter
 * depends on `type` — a text block uses title/body, an image block uses
 * imageUrl (+ title as its caption), and the live blocks use itemCount.
 * They're kept as plain columns rather than a JSON blob so the admin's
 * editor and the app can both read them without a schema of their own.
 */
@Entity('poi_page_blocks')
@Index('IDX_poi_page_blocks_poi', ['poi'])
export class PoiPageBlock {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Poi, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'poi_id' })
  poi!: Relation<Poi>;

  @Column({ type: 'enum', enum: PageBlockType })
  type!: PageBlockType;

  // Order on the page, ascending. Gaps are fine: reordering rewrites every
  // block's position in one go.
  @Column('int')
  position!: number;

  // A heading for a text block, a caption for an image, or an override for
  // a live block's default heading.
  // Spelled-out column type: a `string | null` property reflects as
  // `Object`, which TypeORM cannot map to a Postgres data type.
  @Column('varchar', { nullable: true })
  title?: string | null;

  @Column('text', { nullable: true })
  body?: string | null;

  // Relative path (e.g. /uploads/poi-pages/<file>.jpg) served statically;
  // the app and the dashboard both prefix it with their API base URL.
  @Column('varchar', { name: 'image_url', nullable: true })
  imageUrl?: string | null;

  // How many entries a live block shows. Ignored by text/image/donate.
  @Column({ name: 'item_count', type: 'int', default: 3 })
  itemCount!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
