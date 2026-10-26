import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Seb, 18 Oct 2026: the Dons module is free, and INFUNION keeps a small share
 * of each gift instead (donations/platform-fee.ts). Each gift records that
 * share from now on; gifts made before keep 0. A Dons module on trial or
 * paused for want of payment simply carries on, and one the office had
 * asked to stop at the end of its period stops now, as a free module does.
 */
export class FreeDonations1792200000000 implements MigrationInterface {
    name = 'FreeDonations1792200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "donations" ADD "platform_fee" numeric(10,2) NOT NULL DEFAULT 0`);
        await queryRunner.query(`
            UPDATE "active_modules" SET "status" = 'cancelled', "cancel_at_period_end" = false, "paid_until" = NULL
            WHERE "module_type" = 'donations' AND "status" = 'active' AND "cancel_at_period_end" = true
        `);
        await queryRunner.query(`
            UPDATE "active_modules" SET "status" = 'active', "trial_ends_at" = NULL, "paid_until" = NULL
            WHERE "module_type" = 'donations' AND "status" IN ('trial', 'expired', 'active')
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "donations" DROP COLUMN "platform_fee"`);
    }
}
