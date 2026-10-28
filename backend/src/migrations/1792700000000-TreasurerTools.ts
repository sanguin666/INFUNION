import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * The treasurer's tools, 28 Oct 2026: each community's tax status (which
 * decides receipts, the app's deduction line and the modelo 182) and a
 * phone for the tax office, where a project's money goes, and what is
 * wrong with a monthly gift's card.
 *
 * Every community starts as "no deduction", the safe reading. The demo
 * communities that issue Spanish receipts (Carmen, Crecer Juntos, Holy
 * Trinity) are under the Ley 49/2002, as their seeds say.
 */
export class TreasurerTools1792700000000 implements MigrationInterface {
    name = 'TreasurerTools1792700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pois" ADD "tax_scheme" character varying NOT NULL DEFAULT 'none'`);
        await queryRunner.query(`ALTER TABLE "pois" ADD "legal_phone" character varying`);
        await queryRunner.query(`ALTER TABLE "donation_campaigns" ADD "allocation" jsonb`);
        await queryRunner.query(`ALTER TABLE "donations" ADD "payment_problem" character varying`);
        await queryRunner.query(`ALTER TABLE "donations" ADD "payment_problem_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(
            `UPDATE "pois" SET "tax_scheme" = 'es_ley49' WHERE "qr_code_token" IN ('DEMO-CARMEN', 'DEMO-CRECER-JUNTOS') OR "name" IN ('Nuestra Señora del Carmen', 'Crecer Juntos', 'Holy Trinity Chapel')`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "donations" DROP COLUMN "payment_problem_at"`);
        await queryRunner.query(`ALTER TABLE "donations" DROP COLUMN "payment_problem"`);
        await queryRunner.query(`ALTER TABLE "donation_campaigns" DROP COLUMN "allocation"`);
        await queryRunner.query(`ALTER TABLE "pois" DROP COLUMN "legal_phone"`);
        await queryRunner.query(`ALTER TABLE "pois" DROP COLUMN "tax_scheme"`);
    }
}
