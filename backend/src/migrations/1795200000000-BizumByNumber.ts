import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Bizum by number (Seb, 16 Nov 2026): the community's number, and Bizum gifts. */
export class BizumByNumber1795200000000 implements MigrationInterface {
  name = 'BizumByNumber1795200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pois" ADD "bizum_phone" character varying(20)`);
    await queryRunner.query(`ALTER TABLE "donations" ADD "payment_method" character varying(10) NOT NULL DEFAULT 'card'`);
    await queryRunner.query(`ALTER TABLE "donations" ADD "bizum_code" character varying(12)`);
    await queryRunner.query(`ALTER TABLE "donations" ADD "bizum_sent_at" TIMESTAMP WITH TIME ZONE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "donations" DROP COLUMN "bizum_sent_at"`);
    await queryRunner.query(`ALTER TABLE "donations" DROP COLUMN "bizum_code"`);
    await queryRunner.query(`ALTER TABLE "donations" DROP COLUMN "payment_method"`);
    await queryRunner.query(`ALTER TABLE "pois" DROP COLUMN "bizum_phone"`);
  }
}
