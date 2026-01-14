import { MigrationInterface, QueryRunner } from "typeorm";

export class InitMigration1768300339396 implements MigrationInterface {
    name = 'InitMigration1768300339396'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ministry_submission_data" ADD "sequence" integer`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "attached_files" SET DEFAULT '[]'::jsonb`);
        await queryRunner.query(`ALTER TYPE "public"."ministry_submission_indicator_status_enum" RENAME TO "ministry_submission_indicator_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."ministry_submission_indicator_status_enum" AS ENUM('DRAFT', 'ACCEPTED', 'REVERTED', 'RESUBMITTED', 'SUBMITTED_TO_MINISTRY', 'ACCEPTED_BY_MINISTRY', 'ACCEPTED_BY_MOSPI', 'RETURNED_FROM_MINISTRY', 'RETURNED_FROM_MOSPI', 'SUBMITTED_TO_MOSPI')`);
        await queryRunner.query(`ALTER TABLE "ministry_submission_indicator" ALTER COLUMN "status" TYPE "public"."ministry_submission_indicator_status_enum" USING "status"::"text"::"public"."ministry_submission_indicator_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."ministry_submission_indicator_status_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."ministry_submission_indicator_status_enum_old" AS ENUM('DRAFT', 'ACCEPTED', 'REVERTED', 'RESUBMITTED', 'SUBMITTED_TO_STATE', 'ACCEPTED_BY_STATE', 'ACCEPTED_BY_MOSPI', 'RETURNED_FROM_STATE', 'RETURNED_FROM_MOSPI', 'SUBMITTED_TO_MOSPI')`);
        await queryRunner.query(`ALTER TABLE "ministry_submission_indicator" ALTER COLUMN "status" TYPE "public"."ministry_submission_indicator_status_enum_old" USING "status"::"text"::"public"."ministry_submission_indicator_status_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."ministry_submission_indicator_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."ministry_submission_indicator_status_enum_old" RENAME TO "ministry_submission_indicator_status_enum"`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "attached_files" SET DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "ministry_submission_data" DROP COLUMN "sequence"`);
    }

}
