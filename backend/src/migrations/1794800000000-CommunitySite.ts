import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Community website (Seb, 9 Nov 2026, #195): the address (/c/<slug>),
 * whether it is published and which parts the team leaves out.
 */
export class CommunitySite1794800000000 implements MigrationInterface {
  name = 'CommunitySite1794800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pois" ADD "site_slug" character varying(40)`);
    await queryRunner.query(`ALTER TABLE "pois" ADD CONSTRAINT "UQ_b730c5622e30565b8ab3887f201" UNIQUE ("site_slug")`);
    await queryRunner.query(`ALTER TABLE "pois" ADD "site_published" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "pois" ADD "site_hidden" jsonb NOT NULL DEFAULT '[]'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pois" DROP COLUMN "site_hidden"`);
    await queryRunner.query(`ALTER TABLE "pois" DROP COLUMN "site_published"`);
    await queryRunner.query(`ALTER TABLE "pois" DROP CONSTRAINT "UQ_b730c5622e30565b8ab3887f201"`);
    await queryRunner.query(`ALTER TABLE "pois" DROP COLUMN "site_slug"`);
  }
}
