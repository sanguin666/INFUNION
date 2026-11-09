import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { Poi } from '../../pois/entities/poi.entity.js';

export enum OutreachKind {
  INVITATION = 'invitation',
  CONTRIBUTION = 'contribution',
  MESSAGE = 'message',
}

/** One message the team sent to members outside the app, by email. */
@Entity('outreach')
@Index('IDX_outreach_poi', ['poi'])
export class Outreach {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Poi, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'poi_id' })
  poi!: Relation<Poi>;

  @Column({ type: 'varchar', length: 16 })
  kind!: OutreachKind;

  @Column({ type: 'varchar', length: 160 })
  subject!: string;

  @Column({ type: 'text' })
  body!: string;

  // A contribution request for one project, if it named one.
  @Column({ name: 'campaign_id', type: 'uuid', nullable: true })
  campaignId!: string | null;

  // Who it was sent to, as the team chose it ("notInApp", "everyone",
  // "group:Coro", "one"), for the history.
  @Column({ type: 'varchar', length: 80 })
  audience!: string;

  @Column({ name: 'sent_by', type: 'uuid', nullable: true })
  sentBy!: string | null;

  @Column({ type: 'integer', default: 0 })
  recipients!: number;

  @Column({ type: 'integer', default: 0 })
  sent!: number;

  @Column({ type: 'integer', default: 0 })
  failed!: number;

  // Set when the last email has gone (or failed).
  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
