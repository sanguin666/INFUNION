import { Column, Entity, PrimaryColumn } from 'typeorm';

/** How many questions an admin asked the dashboard assistant on a day (UTC). */
@Entity('admin_assistant_usage')
export class AdminAssistantUsage {
  @PrimaryColumn('uuid', { name: 'user_id' })
  userId!: string;

  @PrimaryColumn('date')
  day!: string;

  @Column('int', { default: 0 })
  count!: number;
}
