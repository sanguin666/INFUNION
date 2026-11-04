import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

export const TRANSLATABLE_KINDS = [
  'post',
  'comment',
  'prayer',
  'announcement',
  'event',
  'block',
  'about',
] as const;
export type TranslatableKind = (typeof TRANSLATABLE_KINDS)[number];

/**
 * A text members wrote, translated once into one language and kept, so
 * every later reader in that language gets it without paying again
 * (Seb, 4 Nov 2026). `sourceHash` tells an edited text apart: it is then
 * translated again.
 */
@Entity('content_translations')
@Unique('UQ_content_translations_target', ['kind', 'targetId', 'language'])
export class ContentTranslation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 16 })
  kind!: TranslatableKind;

  @Column({ name: 'target_id', type: 'uuid' })
  targetId!: string;

  // The reader's language (one of the app's codes).
  @Column({ type: 'varchar', length: 8 })
  language!: string;

  // The language the text was written in, as found by the translation.
  @Column({ name: 'source_language', type: 'varchar', length: 16 })
  sourceLanguage!: string;

  @Column({ name: 'source_hash', type: 'varchar', length: 64 })
  sourceHash!: string;

  // Field name → translated text; null when it was already in `language`.
  @Column({ type: 'jsonb', nullable: true })
  fields!: Record<string, string> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
