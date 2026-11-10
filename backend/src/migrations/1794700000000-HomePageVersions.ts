import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Home page versions (Seb, 9 Nov 2026, #194): up to five saved home pages
 * per community, their sections and badges kept as JSON.
 */
export class HomePageVersions1794700000000 implements MigrationInterface {
  name = 'HomePageVersions1794700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "home_page_versions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "poi_id" uuid NOT NULL, "name" character varying(60) NOT NULL, "auto" boolean NOT NULL DEFAULT false, "live" boolean NOT NULL DEFAULT false, "blocks" jsonb NOT NULL, "badges" jsonb NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_180893859964f9775229a478299" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_home_page_versions_poi" ON "home_page_versions"  ("poi_id")`);
    await queryRunner.query(`ALTER TABLE "home_page_versions" ADD CONSTRAINT "FK_home_page_versions_poi" FOREIGN KEY ("poi_id") REFERENCES "pois"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "home_page_versions" DROP CONSTRAINT "FK_home_page_versions_poi"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_home_page_versions_poi"`);
    await queryRunner.query(`DROP TABLE "home_page_versions"`);
  }
}
