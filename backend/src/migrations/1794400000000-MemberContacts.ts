import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Members imported from a community's own list, and the messages the team
 * sends them outside the app (Seb, 9 Nov 2026). A gift made from such a
 * message remembers the contact it came from (donations.contact_id).
 */

export class MemberContacts1794400000000 implements MigrationInterface {
    name = 'MemberContacts1794400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "contacts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "first_name" character varying(80), "last_name" character varying(120), "email" character varying(200), "phone" character varying(20), "phone_key" character varying(9), "whatsapp" character varying(20), "telegram" character varying(64), "language" character varying(2), "groups" jsonb NOT NULL DEFAULT '[]', "linked_at" TIMESTAMP WITH TIME ZONE, "token" character varying(32) NOT NULL, "invited_at" TIMESTAMP WITH TIME ZONE, "last_written_at" TIMESTAMP WITH TIME ZONE, "unsubscribed_at" TIMESTAMP WITH TIME ZONE, "source" character varying(200), "added_by" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "poi_id" uuid NOT NULL, "user_id" uuid, CONSTRAINT "UQ_9c7891d58924351c69f912a9fff" UNIQUE ("token"), CONSTRAINT "PK_b99cd40cfd66a99f1571f4f72e6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_contacts_phone_key" ON "contacts"  ("phone_key") `);
        await queryRunner.query(`CREATE INDEX "IDX_contacts_email" ON "contacts"  ("email") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_contacts_poi_email" ON "contacts"  ("poi_id", "email") WHERE "email" IS NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_contacts_user" ON "contacts"  ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_contacts_poi" ON "contacts"  ("poi_id") `);
        await queryRunner.query(`CREATE TABLE "outreach" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "kind" character varying(16) NOT NULL, "subject" character varying(160) NOT NULL, "body" text NOT NULL, "campaign_id" uuid, "audience" character varying(80) NOT NULL, "sent_by" uuid, "recipients" integer NOT NULL DEFAULT '0', "sent" integer NOT NULL DEFAULT '0', "failed" integer NOT NULL DEFAULT '0', "finished_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "poi_id" uuid NOT NULL, CONSTRAINT "PK_4aac4875bf6f25c18b43b16692f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_outreach_poi" ON "outreach"  ("poi_id") `);
        await queryRunner.query(`CREATE TABLE "outreach_recipients" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "channel" character varying(12) NOT NULL DEFAULT 'email', "sent_at" TIMESTAMP WITH TIME ZONE, "error" character varying(200), "clicked_at" TIMESTAMP WITH TIME ZONE, "outreach_id" uuid NOT NULL, "contact_id" uuid NOT NULL, CONSTRAINT "PK_93703a20dc85196ab1ea7292bce" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_outreach_recipients_contact" ON "outreach_recipients"  ("contact_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_outreach_recipients_outreach" ON "outreach_recipients"  ("outreach_id") `);
        await queryRunner.query(`ALTER TABLE "donations" ADD "contact_id" uuid`);
        await queryRunner.query(`ALTER TABLE "contacts" ADD CONSTRAINT "FK_00f2ce96623698f7b1cfb4f6a63" FOREIGN KEY ("poi_id") REFERENCES "pois"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "contacts" ADD CONSTRAINT "FK_af0a71ac1879b584f255c49c99a" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "outreach" ADD CONSTRAINT "FK_a692a3cf37cc3917b4c0b836c5d" FOREIGN KEY ("poi_id") REFERENCES "pois"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "outreach_recipients" ADD CONSTRAINT "FK_b056d1799c4a21a3547479a0109" FOREIGN KEY ("outreach_id") REFERENCES "outreach"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "outreach_recipients" ADD CONSTRAINT "FK_395a4995c061e81b8d40bef68ba" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "outreach_recipients" DROP CONSTRAINT "FK_395a4995c061e81b8d40bef68ba"`);
        await queryRunner.query(`ALTER TABLE "outreach_recipients" DROP CONSTRAINT "FK_b056d1799c4a21a3547479a0109"`);
        await queryRunner.query(`ALTER TABLE "outreach" DROP CONSTRAINT "FK_a692a3cf37cc3917b4c0b836c5d"`);
        await queryRunner.query(`ALTER TABLE "contacts" DROP CONSTRAINT "FK_af0a71ac1879b584f255c49c99a"`);
        await queryRunner.query(`ALTER TABLE "contacts" DROP CONSTRAINT "FK_00f2ce96623698f7b1cfb4f6a63"`);
        await queryRunner.query(`ALTER TABLE "donations" DROP COLUMN "contact_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_outreach_recipients_outreach"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_outreach_recipients_contact"`);
        await queryRunner.query(`DROP TABLE "outreach_recipients"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_outreach_poi"`);
        await queryRunner.query(`DROP TABLE "outreach"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_contacts_poi"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_contacts_user"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_contacts_poi_email"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_contacts_email"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_contacts_phone_key"`);
        await queryRunner.query(`DROP TABLE "contacts"`);
    }

}
