import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Payment links (Seb, 10 Nov 2026): named links with their own QR code,
 * a fixed amount or the payer's choice, an optional last day, and which
 * link each contribution came through.
 */
export class PaymentLinks1795000000000 implements MigrationInterface {
  name = 'PaymentLinks1795000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "payment_links" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "code" character varying(12) NOT NULL,
      "title" character varying(120) NOT NULL,
      "amount" numeric(10,2),
      "ask_name" boolean NOT NULL DEFAULT true,
      "ends_on" date,
      "is_default" boolean NOT NULL DEFAULT false,
      "archived_at" TIMESTAMP WITH TIME ZONE,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "poi_id" uuid,
      "campaign_id" uuid,
      CONSTRAINT "UQ_payment_links_code" UNIQUE ("code"),
      CONSTRAINT "PK_payment_links" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_payment_links_poi" ON "payment_links" ("poi_id")`);
    await queryRunner.query(
      `ALTER TABLE "payment_links" ADD CONSTRAINT "FK_0b03622137d101010058ce8711b" FOREIGN KEY ("poi_id") REFERENCES "pois"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payment_links" ADD CONSTRAINT "FK_d25dc749f71c965c75d421fca14" FOREIGN KEY ("campaign_id") REFERENCES "donation_campaigns"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`ALTER TABLE "donations" ADD "payment_link_id" uuid`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "donations" DROP COLUMN "payment_link_id"`);
    await queryRunner.query(`ALTER TABLE "payment_links" DROP CONSTRAINT "FK_d25dc749f71c965c75d421fca14"`);
    await queryRunner.query(`ALTER TABLE "payment_links" DROP CONSTRAINT "FK_0b03622137d101010058ce8711b"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_payment_links_poi"`);
    await queryRunner.query(`DROP TABLE "payment_links"`);
  }
}
