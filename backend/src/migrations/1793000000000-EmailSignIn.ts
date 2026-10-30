import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Sign in with an email or a phone number (Seb, 30 Oct 2026): a sign-in
 * code goes to a phone or to an email address, so the codes table gets an
 * email column and its phone becomes optional.
 */
export class EmailSignIn1793000000000 implements MigrationInterface {
    name = 'EmailSignIn1793000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "phone_verification_codes" ADD "email" character varying`);
        await queryRunner.query(`ALTER TABLE "phone_verification_codes" ALTER COLUMN "phone" DROP NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_f39029495bb13f3ac16ae5b62e" ON "phone_verification_codes"  ("email") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_f39029495bb13f3ac16ae5b62e"`);
        await queryRunner.query(`DELETE FROM "phone_verification_codes" WHERE "phone" IS NULL`);
        await queryRunner.query(`ALTER TABLE "phone_verification_codes" ALTER COLUMN "phone" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "phone_verification_codes" DROP COLUMN "email"`);
    }

}
