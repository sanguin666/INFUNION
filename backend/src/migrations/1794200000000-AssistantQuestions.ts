import type { MigrationInterface, QueryRunner } from 'typeorm';

/** What members ask the assistant, anonymised, for statistics (Seb, 5 Nov 2026). */
export class AssistantQuestions1794200000000 implements MigrationInterface {
  name = 'AssistantQuestions1794200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "assistant_questions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "poi_id" uuid NOT NULL, "topic" character varying(32) NOT NULL, "answered" boolean NOT NULL, "language" character varying(5) NOT NULL, "question" character varying(200), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_assistant_questions" PRIMARY KEY ("id"), CONSTRAINT "FK_assistant_questions_poi" FOREIGN KEY ("poi_id") REFERENCES "pois"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_assistant_questions_poi_created" ON "assistant_questions" ("poi_id", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "assistant_questions"`);
  }
}
