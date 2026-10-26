import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Seb, 26 Oct 2026: associations ask their members to sign up for
 * activities, so a request can now be a registration. Postgres cannot
 * drop an enum value, so down() leaves it in place.
 */
export class RegistrationRequests1792400000000 implements MigrationInterface {
    name = 'RegistrationRequests1792400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TYPE "public"."service_requests_type_enum"
            ADD VALUE IF NOT EXISTS 'registration'
        `);
    }

    public async down(): Promise<void> {}
}
