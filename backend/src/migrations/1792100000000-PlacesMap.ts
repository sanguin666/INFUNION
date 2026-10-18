import { MigrationInterface, QueryRunner } from "typeorm";

/** The map of communities (Seb, 18 Oct 2026): more kinds of place, and
 * coordinates plus a visibility switch on each one. */
export class PlacesMap1792100000000 implements MigrationInterface {
    name = 'PlacesMap1792100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."pois_type_enum" ADD VALUE IF NOT EXISTS 'mosque'`);
        await queryRunner.query(`ALTER TYPE "public"."pois_type_enum" ADD VALUE IF NOT EXISTS 'synagogue'`);
        await queryRunner.query(`ALTER TYPE "public"."pois_type_enum" ADD VALUE IF NOT EXISTS 'other_worship'`);
        await queryRunner.query(`ALTER TYPE "public"."pois_type_enum" ADD VALUE IF NOT EXISTS 'association'`);
        await queryRunner.query(`ALTER TYPE "public"."pois_type_enum" ADD VALUE IF NOT EXISTS 'culture'`);
        await queryRunner.query(`ALTER TABLE "pois" ADD "latitude" double precision`);
        await queryRunner.query(`ALTER TABLE "pois" ADD "longitude" double precision`);
        await queryRunner.query(`ALTER TABLE "pois" ADD "map_visible" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pois" DROP COLUMN "map_visible"`);
        await queryRunner.query(`ALTER TABLE "pois" DROP COLUMN "longitude"`);
        await queryRunner.query(`ALTER TABLE "pois" DROP COLUMN "latitude"`);
        // Postgres can't drop enum values; anything not a church becomes one.
        await queryRunner.query(`UPDATE "pois" SET "type" = 'church' WHERE "type" <> 'church'`);
        await queryRunner.query(`ALTER TYPE "public"."pois_type_enum" RENAME TO "pois_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."pois_type_enum" AS ENUM('church')`);
        await queryRunner.query(`ALTER TABLE "pois" ALTER COLUMN "type" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "pois" ALTER COLUMN "type" TYPE "public"."pois_type_enum" USING "type"::"text"::"public"."pois_type_enum"`);
        await queryRunner.query(`ALTER TABLE "pois" ALTER COLUMN "type" SET DEFAULT 'church'`);
        await queryRunner.query(`DROP TYPE "public"."pois_type_enum_old"`);
    }
}
