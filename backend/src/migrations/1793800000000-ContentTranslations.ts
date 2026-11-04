import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Automatic translation (Seb, 4 Nov 2026): each text members or a team
 * wrote, translated once per language and kept.
 */
export class ContentTranslations1793800000000 implements MigrationInterface {
    name = 'ContentTranslations1793800000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "content_translations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "kind" character varying(16) NOT NULL, "target_id" uuid NOT NULL, "language" character varying(8) NOT NULL, "source_language" character varying(16) NOT NULL, "source_hash" character varying(64) NOT NULL, "fields" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_content_translations_target" UNIQUE ("kind", "target_id", "language"), CONSTRAINT "PK_4a97bf314a12293b8036b3af694" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "content_languages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "kind" character varying(16) NOT NULL, "target_id" uuid NOT NULL, "source_hash" character varying(64) NOT NULL, "language" character varying(16) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_content_languages_target" UNIQUE ("kind", "target_id"), CONSTRAINT "PK_8f5e706a5f53a7f72435d59bed7" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "content_languages"`);
        await queryRunner.query(`DROP TABLE "content_translations"`);
    }
}
