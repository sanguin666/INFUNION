import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * infunion offers one of the three plans, never "everything" (Seb, 30 Oct
 * 2026): a community that was offered as a whole gets Complete offered.
 */
export class OfferPlansOnly1792900000000 implements MigrationInterface {
    name = 'OfferPlansOnly1792900000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `UPDATE "pois" SET "plan" = 'complete', "plan_offered" = true, "plan_trial_ends_at" = NULL,
                "pending_plan" = NULL, "billing_renews_at" = NULL, "billing_comped" = false
             WHERE "billing_comped" = true`,
        );
    }

    public async down(): Promise<void> {
        // Nothing to undo: an offered Complete gives the same as before.
    }
}
