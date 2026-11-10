import type { MigrationInterface, QueryRunner } from 'typeorm';

/** A payment link's own words to the payer (Seb, 10 Nov 2026). */
export class PaymentLinkMessage1795100000000 implements MigrationInterface {
  name = 'PaymentLinkMessage1795100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payment_links" ADD "message" character varying(300)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payment_links" DROP COLUMN "message"`);
  }
}
