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

/**
 * A bulletin/newsletter-style announcement posted by a POI
 * (e.g. weekly bulletin, schedule changes, general news).
 */
@Entity('announcements')
@Index('IDX_announcements_poi', ['poi'])
export class Announcement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Poi, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'poi_id' })
  poi!: Relation<Poi>;

  @Column()
  title!: string;

  @Column('text', { nullable: true })
  body?: string | null;

  // Relative path (e.g. /uploads/announcements/<file>.m4a) to an optional
  // voice message recorded in the app, e.g. by church staff instead of
  // typing. Served statically; the app prefixes it with its API base URL.
  @Column({ name: 'audio_url', nullable: true })
  audioUrl?: string;

  // Relative path (/uploads/announcements/<file>.jpg) or a full URL to the
  // post's photo, added from the admin. Shown big on the News tab when the
  // post is the newest, as a thumbnail in the list otherwise.
  @Column({ name: 'image_url', type: 'varchar', nullable: true })
  imageUrl?: string | null;

  // Marked by the office as something members must not miss; the app puts
  // an "Important" label on it, in the same dark orange as home messages.
  @Column({ default: false })
  important!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
