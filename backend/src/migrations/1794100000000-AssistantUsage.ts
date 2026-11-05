import type { MigrationInterface, QueryRunner } from 'typeorm';

/** The member assistant's daily count per member (Seb, 5 Nov 2026). */
export class AssistantUsage1794100000000 implements MigrationInterface {
  name = 'AssistantUsage1794100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "assistant_usage" ("user_id" uuid NOT NULL, "day" date NOT NULL, "count" integer NOT NULL DEFAULT 0, CONSTRAINT "PK_assistant_usage" PRIMARY KEY ("user_id", "day"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "assistant_usage"`);
  }
}
