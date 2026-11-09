import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { Outreach } from './outreach.entity.js';
import { Contact } from './contact.entity.js';

/**
 * One person a message went to. Its id is in the message's button, so a
 * click is counted for that message (and the invitation or contribution
 * page knows who it is for).
 */
@Entity('outreach_recipients')
@Index('IDX_outreach_recipients_outreach', ['outreach'])
@Index('IDX_outreach_recipients_contact', ['contact'])
export class OutreachRecipient {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Outreach, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'outreach_id' })
  outreach!: Relation<Outreach>;

  @ManyToOne(() => Contact, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'contact_id' })
  contact!: Relation<Contact>;

  // "email" or "whatsapp" (a WhatsApp invitation the team sent by hand).
  @Column({ type: 'varchar', length: 12, default: 'email' })
  channel!: string;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt!: Date | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  error!: string | null;

  @Column({ name: 'clicked_at', type: 'timestamptz', nullable: true })
  clickedAt!: Date | null;
}
