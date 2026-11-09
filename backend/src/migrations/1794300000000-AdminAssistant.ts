import type { MigrationInterface, QueryRunner } from 'typeorm';

/** The dashboard's AI assistant (Seb, 6 Nov 2026): a daily count per admin, and who asked each recorded question. */
export class AdminAssistant1794300000000 implements MigrationInterface {
  name = 'AdminAssistant1794300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "admin_assistant_usage" ("user_id" uuid NOT NULL, "day" date NOT NULL, "count" integer NOT NULL DEFAULT 0, CONSTRAINT "PK_admin_assistant_usage" PRIMARY KEY ("user_id", "day"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "assistant_questions" ADD "audience" character varying(8) NOT NULL DEFAULT 'member'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "assistant_questions" DROP COLUMN "audience"`);
    await queryRunner.query(`DROP TABLE "admin_assistant_usage"`);
  }
}
