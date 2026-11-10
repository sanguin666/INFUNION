import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seb, 10 Nov 2026: the demo association Crecer Juntos shows the
 * "Set up your payment account" strip, so the demo can show that step.
 * Its demo payment account (given by CommunityPayouts) is removed once;
 * clicking "Set up my payment account" links it again. Carmen keeps its own.
 */
export class CrecerJuntosPayoutsUnset1794900000000 implements MigrationInterface {
  name = 'CrecerJuntosPayoutsUnset1794900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "pois" SET "stripe_account_id" = NULL WHERE "qr_code_token" = 'DEMO-CRECER-JUNTOS' AND "stripe_account_id" = 'demo'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "pois" SET "stripe_account_id" = 'demo' WHERE "qr_code_token" = 'DEMO-CRECER-JUNTOS' AND "stripe_account_id" IS NULL`,
    );
  }
}
