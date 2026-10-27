import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * GDPR, 27 Oct 2026: which terms each person accepted and when, and the
 * explicit consent a church membership needs (religious belief is a
 * special category). Existing rows start empty, so everyone is asked once.
 */
export class GdprConsentRecords1792500000000 implements MigrationInterface {
    name = 'GdprConsentRecords1792500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_pois" ADD "religious_consent_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "users" ADD "consent_version" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "consented_at" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "consented_at"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "consent_version"`);
        await queryRunner.query(`ALTER TABLE "user_pois" DROP COLUMN "religious_consent_at"`);
    }
}
