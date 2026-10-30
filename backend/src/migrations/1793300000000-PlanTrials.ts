import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * The free month is given once per organisation, not only once per place
 * (Seb, 30 Oct 2026): every trial is recorded with the place's tax ID, and
 * the record outlives the place. The trials already given are recorded too.
 */
export class PlanTrials1793300000000 implements MigrationInterface {
    name = 'PlanTrials1793300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "plan_trials" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "started_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "poi_id" uuid,
                "place_name" character varying NOT NULL,
                "tax_id" character varying,
                "plan" character varying NOT NULL,
                CONSTRAINT "PK_20ba7b64521e9ee434866d4c3a8" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_6b8a6a988926f850c4e637618a" ON "plan_trials" ("tax_id")`);
        await queryRunner.query(`
            INSERT INTO "plan_trials" ("poi_id", "place_name", "tax_id", "plan")
            SELECT "id", "name",
                   NULLIF(upper(regexp_replace("legal_tax_id", '[\\s.\\-/]', '', 'g')), ''),
                   "plan"
            FROM "pois" WHERE "plan_trial_used" = true
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_6b8a6a988926f850c4e637618a"`);
        await queryRunner.query(`DROP TABLE "plan_trials"`);
    }
}
