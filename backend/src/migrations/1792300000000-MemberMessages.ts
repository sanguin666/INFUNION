import { MigrationInterface, QueryRunner } from "typeorm";

export class MemberMessages1792300000000 implements MigrationInterface {
    name = 'MemberMessages1792300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "member_messages" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "from_staff" boolean NOT NULL DEFAULT false,
                "body" text NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "conversation_id" uuid,
                "author_id" uuid,
                CONSTRAINT "PK_fd8a7a77c633ecc90765e751a75" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "member_conversations" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "last_message_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "staff_seen_at" TIMESTAMP WITH TIME ZONE,
                "member_seen_at" TIMESTAMP WITH TIME ZONE,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "poi_id" uuid,
                "member_id" uuid,
                CONSTRAINT "PK_273794ae47e9a5252dbe60ab51e" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_4ac8cf0a873ed4b9b285296520" ON "member_conversations" ("poi_id", "member_id")
        `);
        await queryRunner.query(`
            ALTER TABLE "user_pois"
            ADD "notify_messages" boolean NOT NULL DEFAULT true
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_23c4e717610c49881e8939c216"
        `);
        await queryRunner.query(`
            ALTER TYPE "public"."active_modules_module_type_enum"
            ADD VALUE 'messages'
        `);
        await queryRunner.query(`
            ALTER TYPE "public"."poi_badges_link_module_enum"
            ADD VALUE 'messages'
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_23c4e717610c49881e8939c216" ON "active_modules" ("poi_id", "module_type")
        `);
        await queryRunner.query(`
            ALTER TABLE "member_messages"
            ADD CONSTRAINT "FK_ef5ebb47383ee07861250119713" FOREIGN KEY ("conversation_id") REFERENCES "member_conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "member_messages"
            ADD CONSTRAINT "FK_62c7ff97add4d54b31ec48f935f" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "member_conversations"
            ADD CONSTRAINT "FK_02cb7beae9e24d01ef58ca1fb47" FOREIGN KEY ("poi_id") REFERENCES "pois"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "member_conversations"
            ADD CONSTRAINT "FK_1123861f4ad1eaf42b44ea8a2c6" FOREIGN KEY ("member_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "member_conversations" DROP CONSTRAINT "FK_1123861f4ad1eaf42b44ea8a2c6"
        `);
        await queryRunner.query(`
            ALTER TABLE "member_conversations" DROP CONSTRAINT "FK_02cb7beae9e24d01ef58ca1fb47"
        `);
        await queryRunner.query(`
            ALTER TABLE "member_messages" DROP CONSTRAINT "FK_62c7ff97add4d54b31ec48f935f"
        `);
        await queryRunner.query(`
            ALTER TABLE "member_messages" DROP CONSTRAINT "FK_ef5ebb47383ee07861250119713"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_23c4e717610c49881e8939c216"
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."poi_badges_link_module_enum_old" AS ENUM(
                'donations',
                'events',
                'announcements',
                'prayer_requests',
                'livestreams',
                'community',
                'requests',
                'mass_intentions',
                'daily_readings'
            )
        `);
        await queryRunner.query(`
            ALTER TABLE "poi_badges"
            ALTER COLUMN "link_module" TYPE "public"."poi_badges_link_module_enum_old" USING "link_module"::"text"::"public"."poi_badges_link_module_enum_old"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."poi_badges_link_module_enum"
        `);
        await queryRunner.query(`
            ALTER TYPE "public"."poi_badges_link_module_enum_old"
            RENAME TO "poi_badges_link_module_enum"
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."active_modules_module_type_enum_old" AS ENUM(
                'donations',
                'events',
                'announcements',
                'prayer_requests',
                'livestreams',
                'community',
                'requests',
                'mass_intentions',
                'daily_readings'
            )
        `);
        await queryRunner.query(`
            ALTER TABLE "active_modules"
            ALTER COLUMN "module_type" TYPE "public"."active_modules_module_type_enum_old" USING "module_type"::"text"::"public"."active_modules_module_type_enum_old"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."active_modules_module_type_enum"
        `);
        await queryRunner.query(`
            ALTER TYPE "public"."active_modules_module_type_enum_old"
            RENAME TO "active_modules_module_type_enum"
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_23c4e717610c49881e8939c216" ON "active_modules" USING btree ("module_type", "poi_id")
        `);
        await queryRunner.query(`
            ALTER TABLE "user_pois" DROP COLUMN "notify_messages"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_4ac8cf0a873ed4b9b285296520"
        `);
        await queryRunner.query(`
            DROP TABLE "member_conversations"
        `);
        await queryRunner.query(`
            DROP TABLE "member_messages"
        `);
    }

}
