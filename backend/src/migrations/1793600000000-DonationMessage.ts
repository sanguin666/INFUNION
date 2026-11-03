import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * An optional note from the giver to the team, on a gift to where it is
 * most needed (Seb, 3 Nov 2026).
 */
export class DonationMessage1793600000000 implements MigrationInterface {
    name = 'DonationMessage1793600000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "donations" ADD "message" character varying(300)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "donations" DROP COLUMN "message"`);
    }
}
