import { Column, Entity, PrimaryColumn } from 'typeorm';

/** How many questions a member asked the assistant on a day (UTC). */
@Entity('assistant_usage')
export class AssistantUsage {
  @PrimaryColumn('uuid', { name: 'user_id' })
  userId!: string;

  @PrimaryColumn('date')
  day!: string;

  @Column('int', { default: 0 })
  count!: number;
}
