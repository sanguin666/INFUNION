import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Places register themselves from the landing (Seb, 30 Oct 2026): their
 * requests, and the emails and tax IDs the superadmin has blocked.
 */
export class PlaceRegistrations1793100000000 implements MigrationInterface {
    name = 'PlaceRegistrations1793100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "place_registrations" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "status" character varying NOT NULL DEFAULT 'pending',
                "place_name" character varying NOT NULL,
                "type" character varying NOT NULL,
                "address" character varying NOT NULL,
                "postal_code" character varying NOT NULL,
                "city" character varying NOT NULL,
                "country" character varying(2) NOT NULL,
                "language" character varying NOT NULL,
                "website" character varying,
                "legal_name" character varying NOT NULL,
                "tax_id" character varying NOT NULL,
                "document_path" character varying,
                "document_name" character varying,
                "existing_poi_id" uuid,
                "first_name" character varying NOT NULL,
                "last_name" character varying NOT NULL,
                "role" character varying NOT NULL,
                "email" character varying NOT NULL,
                "phone" character varying,
                "plan" character varying NOT NULL DEFAULT 'basic',
                "billing_interval" character varying NOT NULL DEFAULT 'monthly',
                "terms_version" character varying NOT NULL,
                "dpa_version" character varying NOT NULL,
                "religious_data_agreed" boolean NOT NULL DEFAULT false,
                "signed_name" character varying NOT NULL,
                "signed_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "ip" character varying,
                "user_agent" character varying,
                "document_checked_at" TIMESTAMP WITH TIME ZONE,
                "question" text,
                "questioned_at" TIMESTAMP WITH TIME ZONE,
                "decline_reason" text,
                "decided_at" TIMESTAMP WITH TIME ZONE,
                "decided_by" character varying,
                "poi_id" uuid,
                CONSTRAINT "PK_5419155ca28b89fc8bde52f0619" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_3ca7aad80f7db16fcc82289d30" ON "place_registrations" ("tax_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_7e6b818b9c711dd01336c7e9fe" ON "place_registrations" ("email")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_268bb428d2cd3c85236bdffdaf" ON "place_registrations" ("ip")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_f35712416578680491cb898a66" ON "place_registrations" ("status", "created_at")
        `);
        await queryRunner.query(`
            CREATE TABLE "registration_blocks" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "kind" character varying NOT NULL,
                "value" character varying NOT NULL,
                "registration_id" uuid,
                CONSTRAINT "UQ_2e97efd18be7139455d1b4a159e" UNIQUE ("kind", "value"),
                CONSTRAINT "PK_e8ebd5aa6d96fb981cf8261f92a" PRIMARY KEY ("id")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP TABLE "registration_blocks"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_f35712416578680491cb898a66"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_268bb428d2cd3c85236bdffdaf"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_7e6b818b9c711dd01336c7e9fe"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_3ca7aad80f7db16fcc82289d30"
        `);
        await queryRunner.query(`
            DROP TABLE "place_registrations"
        `);
    }

}
