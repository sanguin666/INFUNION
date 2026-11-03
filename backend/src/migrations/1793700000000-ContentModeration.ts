import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Report and block for posts, replies and prayer requests (Apple guideline
 * 1.2, Seb, 3 Nov 2026): members' reports, the people a member hid, and
 * the members a team blocked from posting.
 */
export class ContentModeration1793700000000 implements MigrationInterface {
    name = 'ContentModeration1793700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "content_reports" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "poi_id" uuid,
                "kind" character varying(16) NOT NULL,
                "target_id" uuid NOT NULL,
                "post_id" uuid,
                "reporter_id" uuid,
                "reason" character varying(24) NOT NULL,
                "excerpt" text NOT NULL,
                "author_name" character varying,
                "author_id" uuid,
                "content_created_at" TIMESTAMP WITH TIME ZONE,
                "status" character varying(16) NOT NULL DEFAULT 'open',
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "resolved_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_content_reports" PRIMARY KEY ("id"),
                CONSTRAINT "FK_8e5c60842282d92590b9908a200" FOREIGN KEY ("poi_id") REFERENCES "pois"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_0aababfebc5662624a4a66b639b" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE SET NULL,
                CONSTRAINT "FK_943e06dadd34f9430df2bba1981" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_content_reports_poi_status" ON "content_reports" ("poi_id", "status")`);
        await queryRunner.query(`CREATE INDEX "IDX_content_reports_target" ON "content_reports" ("kind", "target_id")`);
        await queryRunner.query(`
            CREATE TABLE "hidden_people" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" uuid,
                "hidden_id" uuid,
                "hidden_name" character varying,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_hidden_people" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_hidden_people_pair" UNIQUE ("user_id", "hidden_id"),
                CONSTRAINT "FK_c1a4a724e87992e666a85869a08" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_05f2a6228af4b869fa85680e7e4" FOREIGN KEY ("hidden_id") REFERENCES "users"("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "posting_bans" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "poi_id" uuid,
                "user_id" uuid,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_posting_bans" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_posting_bans_pair" UNIQUE ("poi_id", "user_id"),
                CONSTRAINT "FK_d001405c908e08a8d80683fcebb" FOREIGN KEY ("poi_id") REFERENCES "pois"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_e23fbd72fd2804ddff2c06d691b" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "posting_bans"`);
        await queryRunner.query(`DROP TABLE "hidden_people"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_content_reports_target"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_content_reports_poi_status"`);
        await queryRunner.query(`DROP TABLE "content_reports"`);
    }
}
