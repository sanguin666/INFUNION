import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * One question asked to the member assistant, kept for statistics (Seb,
 * 5 Nov 2026: topics + anonymised questions). Never linked to the member:
 * the question is rewritten by the model without anything personal, and
 * erased after 90 days; the topic and whether it was answered stay.
 */
@Entity('assistant_questions')
@Index('IDX_assistant_questions_poi_created', ['poiId', 'createdAt'])
export class AssistantQuestion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'poi_id' })
  poiId!: string;

  @Column('varchar', { length: 32 })
  topic!: string;

  @Column('boolean')
  answered!: boolean;

  @Column('varchar', { length: 5 })
  language!: string;

  @Column('varchar', { length: 200, nullable: true })
  question!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
