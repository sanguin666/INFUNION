import { MigrationInterface, QueryRunner } from "typeorm";


/** The superadmin section (Seb, 17 Oct 2026): the flag and authenticator
 * secret on users, the Journal, suspended communities and offered modules. */
export class Superadmin1792000000000 implements MigrationInterface {
    name = 'Superadmin1792000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "audit_log" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "action" character varying NOT NULL, "actor_id" uuid, "actor_email" character varying, "poi_id" uuid, "poi_name" character varying, "details" jsonb NOT NULL DEFAULT '{}', "ip" character varying, CONSTRAINT "PK_07fefa57f7f5ab8fc3f52b3ed0b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2ad7930a7c2af80585c8c1b770" ON "audit_log"  ("created_at") `);
        await queryRunner.query(`ALTER TABLE "active_modules" ADD "offered" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "pois" ADD "suspended_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "users" ADD "is_superadmin" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "users" ADD "totp_secret" text`);
        await queryRunner.query(`ALTER TABLE "users" ADD "totp_pending_secret" text`);
        await queryRunner.query(`ALTER TABLE "users" ADD "totp_last_step" bigint`);
        await queryRunner.query(`ALTER TABLE "users" ADD "last_seen_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "users" ADD "last_login_at" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "last_login_at"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "last_seen_at"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "totp_last_step"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "totp_pending_secret"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "totp_secret"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "is_superadmin"`);
        await queryRunner.query(`ALTER TABLE "pois" DROP COLUMN "suspended_at"`);
        await queryRunner.query(`ALTER TABLE "active_modules" DROP COLUMN "offered"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2ad7930a7c2af80585c8c1b770"`);
        await queryRunner.query(`DROP TABLE "audit_log"`);
    }

}
