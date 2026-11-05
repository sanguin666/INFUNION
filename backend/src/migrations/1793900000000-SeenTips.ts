import type { MigrationInterface, QueryRunner } from 'typeorm';

/** The admin's welcome tour and page tips already seen (Seb, 5 Nov 2026). */
export class SeenTips1793900000000 implements MigrationInterface {
  name = 'SeenTips1793900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "seen_tips" jsonb NOT NULL DEFAULT '[]'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "seen_tips"`);
  }
}
