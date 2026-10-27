import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { ServiceRequest } from './service-request.entity.js';

/**
 * A paper staff asked for ("Birth certificate of the child"), and the file
 * the member sent for it once they have. A checklist the member can tick
 * off from the app instead of bringing photocopies to the office.
 */
@Entity('service_request_documents')
@Index('IDX_service_request_documents_request', ['request'])
export class ServiceRequestDocument {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => ServiceRequest, (request) => request.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'request_id' })
  request!: Relation<ServiceRequest>;

  @Column()
  label!: string;

  // Anything that helps the member find the right paper.
  @Column('text', { nullable: true })
  note?: string | null;

  @Column('varchar', { name: 'file_path', nullable: true })
  filePath?: string | null;

  @Column('varchar', { name: 'file_name', nullable: true })
  fileName?: string | null;

  @Column('varchar', { name: 'file_mime', nullable: true })
  fileMime?: string | null;

  // Set when a file arrives, or when staff tick the paper off by hand
  // because it was handed in at the office.
  @Column('timestamptz', { name: 'received_at', nullable: true })
  receivedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
