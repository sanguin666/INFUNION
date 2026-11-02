import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * A place's admins can close its account themselves (Seb, 2 Nov 2026):
 * the closing dates on the place, and gifts and infunion's invoices no
 * longer deleted with a place (they are records the law says to keep).
 */
export class PlaceClosure1793400000000 implements MigrationInterface {
    name = 'PlaceClosure1793400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pois" ADD "closing_requested_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "pois" ADD "closes_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "pois" ADD "closed_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "pois" ADD "closing_requested_by" character varying`);
        await queryRunner.query(`ALTER TABLE "pois" ADD "closing_reason" character varying`);
        await queryRunner.query(`ALTER TABLE "donations" DROP CONSTRAINT "FK_47d2dac5a6c64315e64ffa37db1"`);
        await queryRunner.query(`ALTER TABLE "donations" ADD CONSTRAINT "FK_47d2dac5a6c64315e64ffa37db1" FOREIGN KEY ("poi_id") REFERENCES "pois"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "billing_invoices" DROP CONSTRAINT "FK_53b0f98a7e2c2d02e6405d4d42c"`);
        await queryRunner.query(`ALTER TABLE "billing_invoices" ADD CONSTRAINT "FK_53b0f98a7e2c2d02e6405d4d42c" FOREIGN KEY ("poi_id") REFERENCES "pois"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "billing_invoices" DROP CONSTRAINT "FK_53b0f98a7e2c2d02e6405d4d42c"`);
        await queryRunner.query(`ALTER TABLE "billing_invoices" ADD CONSTRAINT "FK_53b0f98a7e2c2d02e6405d4d42c" FOREIGN KEY ("poi_id") REFERENCES "pois"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "donations" DROP CONSTRAINT "FK_47d2dac5a6c64315e64ffa37db1"`);
        await queryRunner.query(`ALTER TABLE "donations" ADD CONSTRAINT "FK_47d2dac5a6c64315e64ffa37db1" FOREIGN KEY ("poi_id") REFERENCES "pois"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pois" DROP COLUMN "closing_reason"`);
        await queryRunner.query(`ALTER TABLE "pois" DROP COLUMN "closing_requested_by"`);
        await queryRunner.query(`ALTER TABLE "pois" DROP COLUMN "closed_at"`);
        await queryRunner.query(`ALTER TABLE "pois" DROP COLUMN "closes_at"`);
        await queryRunner.query(`ALTER TABLE "pois" DROP COLUMN "closing_requested_at"`);
    }
}
