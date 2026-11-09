import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Poi } from '../pois/entities/poi.entity.js';

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

  // Gone with the community.
  @ManyToOne(() => Poi, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'poi_id', foreignKeyConstraintName: 'FK_assistant_questions_poi' })
  poi?: Poi;

  // Who asked: a member in the app, or the team in the dashboard (Seb, 6 Nov 2026).
  @Column('varchar', { length: 8, default: 'member' })
  audience!: 'member' | 'admin';

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
