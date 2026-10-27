import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { ServiceRequest } from './service-request.entity.js';

/**
 * One message in a request's conversation, from the member or from staff,
 * with at most one file attached (a photo of a page, a PDF).
 */
@Entity('service_request_messages')
@Index('IDX_service_request_messages_request', ['request'])
@Index('IDX_service_request_messages_author', ['author'])
export class ServiceRequestMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => ServiceRequest, (request) => request.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'request_id' })
  request!: Relation<ServiceRequest>;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'author_id' })
  author?: Relation<User> | null;

  // Which side wrote it. Kept on the row rather than worked out from the
  // author, because the author can later stop being staff (or be deleted)
  // and the conversation must still read the way it happened.
  @Column({ name: 'from_staff', default: false })
  fromStaff!: boolean;

  @Column('text', { nullable: true })
  body?: string | null;

  // `<folder>/<file>` under PRIVATE_UPLOADS_ROOT — never a public path.
  @Column('varchar', { name: 'attachment_path', nullable: true })
  attachmentPath?: string | null;

  @Column('varchar', { name: 'attachment_name', nullable: true })
  attachmentName?: string | null;

  @Column('varchar', { name: 'attachment_mime', nullable: true })
  attachmentMime?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
