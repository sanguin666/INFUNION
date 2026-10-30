import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * A place can withdraw from its contract within 14 days (Seb, 30 Oct 2026):
 * when it did, and why if it said.
 */
export class RegistrationWithdrawal1793200000000 implements MigrationInterface {
    name = 'RegistrationWithdrawal1793200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "place_registrations" ADD "withdrawn_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "place_registrations" ADD "withdraw_reason" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "place_registrations" DROP COLUMN "withdraw_reason"`);
        await queryRunner.query(`ALTER TABLE "place_registrations" DROP COLUMN "withdrawn_at"`);
    }
}
