import { MigrationInterface, QueryRunner } from "typeorm";

export class CatalanLanguage1793500000000 implements MigrationInterface {
    name = 'CatalanLanguage1793500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const table of ['pois', 'users', 'push_tokens']) {
            await queryRunner.query(`ALTER TYPE "public"."${table}_language_enum" ADD VALUE IF NOT EXISTS 'ca'`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Postgres cannot drop an enum value. Move Catalan rows to Valencian,
        // the closest language the older code knows.
        for (const table of ['pois', 'users', 'push_tokens']) {
            await queryRunner.query(`UPDATE "${table}" SET "language" = 'va' WHERE "language" = 'ca'`);
        }
        await queryRunner.query(`UPDATE "place_registrations" SET "language" = 'va' WHERE "language" = 'ca'`);
    }
}
