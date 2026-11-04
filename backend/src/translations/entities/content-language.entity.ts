import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import type { TranslatableKind } from './content-translation.entity.js';

/**
 * The language a text is written in, found once and kept, so the app shows
 * "Translate" only under what is in another language than the reader's.
 */
@Entity('content_languages')
@Unique('UQ_content_languages_target', ['kind', 'targetId'])
export class ContentLanguage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 16 })
  kind!: TranslatableKind;

  @Column({ name: 'target_id', type: 'uuid' })
  targetId!: string;

  @Column({ name: 'source_hash', type: 'varchar', length: 64 })
  sourceHash!: string;

  // ISO 639-1 code (ca for Catalan and Valencian), or "und".
  @Column({ type: 'varchar', length: 16 })
  language!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
