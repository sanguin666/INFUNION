import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Notifications without an account (Seb, 9 Nov 2026): a phone with no
 * user follows communities (device_follows) and rings event bells of its
 * own (event_reminders.push_token_id).
 */
export class GuestNotifications1794600000000 implements MigrationInterface {
  name = 'GuestNotifications1794600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "push_tokens" ALTER COLUMN "user_id" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "event_reminders" ALTER COLUMN "user_id" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "event_reminders" ADD "push_token_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "event_reminders" ADD CONSTRAINT "FK_71b268443a215e8033d7c97fee9" FOREIGN KEY ("push_token_id") REFERENCES "push_tokens"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_event_reminders_push_token_event" ON "event_reminders" ("push_token_id", "event_id") WHERE "push_token_id" IS NOT NULL`,
    );
    await queryRunner.query(`
      CREATE TABLE "device_follows" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "notify_news" boolean NOT NULL DEFAULT true,
        "notify_events" boolean NOT NULL DEFAULT true,
        "notify_live" boolean NOT NULL DEFAULT true,
        "notify_readings" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "push_token_id" uuid NOT NULL,
        "poi_id" uuid NOT NULL,
        CONSTRAINT "PK_device_follows" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_device_follows_token_poi" ON "device_follows" ("push_token_id", "poi_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_device_follows_poi" ON "device_follows" ("poi_id")`);
    await queryRunner.query(
      `ALTER TABLE "device_follows" ADD CONSTRAINT "FK_ec6d2ad67abbc720cb75876edcd" FOREIGN KEY ("push_token_id") REFERENCES "push_tokens"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "device_follows" ADD CONSTRAINT "FK_249a15ce441cfc5da3892820183" FOREIGN KEY ("poi_id") REFERENCES "pois"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "device_follows"`);
    await queryRunner.query(`DROP INDEX "IDX_event_reminders_push_token_event"`);
    await queryRunner.query(`ALTER TABLE "event_reminders" DROP CONSTRAINT "FK_71b268443a215e8033d7c97fee9"`);
    await queryRunner.query(`ALTER TABLE "event_reminders" DROP COLUMN "push_token_id"`);
    await queryRunner.query(`DELETE FROM "event_reminders" WHERE "user_id" IS NULL`);
    await queryRunner.query(`ALTER TABLE "event_reminders" ALTER COLUMN "user_id" SET NOT NULL`);
    await queryRunner.query(`DELETE FROM "push_tokens" WHERE "user_id" IS NULL`);
    await queryRunner.query(`ALTER TABLE "push_tokens" ALTER COLUMN "user_id" SET NOT NULL`);
  }
}
