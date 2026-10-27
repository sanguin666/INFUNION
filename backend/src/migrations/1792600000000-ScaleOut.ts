import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Running as several copies, 27 Oct 2026: the shared failed-login counts
 * (rate_limits), the reminders' next check time, an index on every foreign
 * key the app filters by, and the map's indexes (coordinates, and a
 * trigram index on the folded name the search by name uses).
 *
 * pg_trgm comes with Postgres but is an extension: if the database won't
 * allow it, the name index is skipped with a notice and search by name
 * works as before, only without the index.
 */
export class ScaleOut1792600000000 implements MigrationInterface {
    name = 'ScaleOut1792600000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "rate_limits" ("key" character varying(300) NOT NULL, "count" integer NOT NULL DEFAULT '0', "first_at" TIMESTAMP WITH TIME ZONE NOT NULL, "locked_until" TIMESTAMP WITH TIME ZONE, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_8cb6aa4831e3e775ccf370521db" PRIMARY KEY ("key"))`);
        await queryRunner.query(`ALTER TABLE "event_reminders" ADD "next_check_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`CREATE INDEX "IDX_pois_lat_lng" ON "pois" ("latitude", "longitude")`);
        await queryRunner.query(`CREATE INDEX "IDX_user_pois_poi" ON "user_pois" ("poi_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_announcements_poi" ON "announcements" ("poi_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_events_poi" ON "events" ("poi_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_prayer_requests_author" ON "prayer_requests" ("author_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_prayer_requests_poi" ON "prayer_requests" ("poi_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_livestreams_poi" ON "livestreams" ("poi_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_community_posts_author" ON "community_posts" ("author_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_community_posts_poi" ON "community_posts" ("poi_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_community_comments_author" ON "community_comments" ("author_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_community_comments_post" ON "community_comments" ("post_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_donation_campaigns_poi" ON "donation_campaigns" ("poi_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_donations_donor" ON "donations" ("donor_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_donations_campaign" ON "donations" ("campaign_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_donations_poi" ON "donations" ("poi_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_poi_page_blocks_poi" ON "poi_page_blocks" ("poi_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_service_request_messages_author" ON "service_request_messages" ("author_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_service_request_messages_request" ON "service_request_messages" ("request_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_service_request_documents_request" ON "service_request_documents" ("request_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_service_requests_requester" ON "service_requests" ("requester_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_service_requests_poi" ON "service_requests" ("poi_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_mass_intentions_donation" ON "mass_intentions" ("donation_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_mass_intentions_requester" ON "mass_intentions" ("requester_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_mass_intentions_poi" ON "mass_intentions" ("poi_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_poi_badges_poi" ON "poi_badges" ("poi_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_push_tokens_user" ON "push_tokens" ("user_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_event_reminders_next_check_at" ON "event_reminders" ("next_check_at")`);
        await queryRunner.query(`CREATE INDEX "IDX_event_reminders_event" ON "event_reminders" ("event_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_member_messages_author" ON "member_messages" ("author_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_member_messages_conversation" ON "member_messages" ("conversation_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_member_conversations_member" ON "member_conversations" ("member_id")`);
        await queryRunner.query(`
            DO $$
            BEGIN
                CREATE EXTENSION IF NOT EXISTS pg_trgm;
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'pg_trgm unavailable (%), search by name runs without its index', SQLERRM;
            END $$
        `);
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
                    EXECUTE $idx$CREATE INDEX "IDX_pois_name_search" ON "pois" USING gin (lower(translate(name, 'áàâäãåéèêëíìîïóòôöõúùûüñçÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑÇ’', 'aaaaaaeeeeiiiiooooouuuuncaaaaaaeeeeiiiiooooouuuunc''')) gin_trgm_ops)$idx$;
                END IF;
            END $$
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_pois_name_search"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_member_conversations_member"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_member_messages_conversation"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_member_messages_author"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_event_reminders_event"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_event_reminders_next_check_at"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_push_tokens_user"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_poi_badges_poi"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_mass_intentions_poi"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_mass_intentions_requester"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_mass_intentions_donation"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_service_requests_poi"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_service_requests_requester"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_service_request_documents_request"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_service_request_messages_request"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_service_request_messages_author"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_poi_page_blocks_poi"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_donations_poi"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_donations_campaign"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_donations_donor"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_donation_campaigns_poi"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_community_comments_post"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_community_comments_author"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_community_posts_poi"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_community_posts_author"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_livestreams_poi"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_prayer_requests_poi"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_prayer_requests_author"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_events_poi"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_announcements_poi"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_user_pois_poi"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_pois_lat_lng"`);
        await queryRunner.query(`ALTER TABLE "event_reminders" DROP COLUMN "next_check_at"`);
        await queryRunner.query(`DROP TABLE "rate_limits"`);
    }
}
