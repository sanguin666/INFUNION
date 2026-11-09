import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Contributions paid straight to each community (Seb, 9 Nov 2026): the
 * community's own Stripe account (Stripe Connect) and which account each
 * gift was made on. Communities that exist today keep taking demo gifts:
 * they get the demo account, which only counts while no Stripe key is set.
 */
export class CommunityPayouts1794400000000 implements MigrationInterface {
  name = 'CommunityPayouts1794400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pois" ADD "stripe_account_id" character varying`);
    await queryRunner.query(`ALTER TABLE "pois" ADD "stripe_charges_enabled" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "pois" ADD "stripe_payouts_enabled" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "pois" ADD "stripe_details_submitted" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_pois_stripe_account" ON "pois" ("stripe_account_id") WHERE "stripe_account_id" IS NOT NULL AND "stripe_account_id" <> 'demo'`);
    await queryRunner.query(`ALTER TABLE "donations" ADD "stripe_account_id" character varying`);
    await queryRunner.query(`UPDATE "pois" SET "stripe_account_id" = 'demo' WHERE "closed_at" IS NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "donations" DROP COLUMN "stripe_account_id"`);
    await queryRunner.query(`DROP INDEX "IDX_pois_stripe_account"`);
    await queryRunner.query(`ALTER TABLE "pois" DROP COLUMN "stripe_details_submitted"`);
    await queryRunner.query(`ALTER TABLE "pois" DROP COLUMN "stripe_payouts_enabled"`);
    await queryRunner.query(`ALTER TABLE "pois" DROP COLUMN "stripe_charges_enabled"`);
    await queryRunner.query(`ALTER TABLE "pois" DROP COLUMN "stripe_account_id"`);
  }
}
