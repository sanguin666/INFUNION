import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Plans instead of per-module prices (Seb, 29 Oct 2026): Basic (free),
 * Essentials and Complete. Every community starts on Basic with its free
 * month still to try; "Offert" ones keep everything. Nothing was really
 * charged under the old prices (demo stage), so the per-module trials and
 * paid periods are simply closed: a module that was on stays wanted, and
 * waits paused until a plan has it. Yearly becomes the default interval.
 */
export class Plans1792800000000 implements MigrationInterface {
    name = 'Plans1792800000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pois" ADD "plan" character varying NOT NULL DEFAULT 'basic'`);
        await queryRunner.query(`ALTER TABLE "pois" ADD "plan_trial_ends_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "pois" ADD "plan_trial_used" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "pois" ADD "pending_plan" character varying`);
        await queryRunner.query(`ALTER TABLE "pois" ADD "plan_offered" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "pois" ALTER COLUMN "billing_interval" SET DEFAULT 'yearly'`);
        await queryRunner.query(`UPDATE "pois" SET "billing_renews_at" = NULL`);
        await queryRunner.query(
            `UPDATE "active_modules" SET "status" = 'active' WHERE "status" = 'trial'`,
        );
        await queryRunner.query(
            `UPDATE "active_modules" SET "trial_ends_at" = NULL, "paid_until" = NULL, "cancel_at_period_end" = false`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pois" ALTER COLUMN "billing_interval" SET DEFAULT 'monthly'`);
        await queryRunner.query(`ALTER TABLE "pois" DROP COLUMN "plan_offered"`);
        await queryRunner.query(`ALTER TABLE "pois" DROP COLUMN "pending_plan"`);
        await queryRunner.query(`ALTER TABLE "pois" DROP COLUMN "plan_trial_used"`);
        await queryRunner.query(`ALTER TABLE "pois" DROP COLUMN "plan_trial_ends_at"`);
        await queryRunner.query(`ALTER TABLE "pois" DROP COLUMN "plan"`);
    }
}
