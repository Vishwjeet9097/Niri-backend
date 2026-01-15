import { MigrationInterface, QueryRunner } from "typeorm";

export class InitMigration1768385324775 implements MigrationInterface {
    name = 'InitMigration1768385324775'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."ministry_submission_status_enum" RENAME TO "ministry_submission_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."ministry_submission_status_enum" AS ENUM('DRAFT', 'SUBMITTED_TO_MINISTRY', 'SUBMITTED_TO_MOSPI_REVIEWER', 'SUBMITTED_TO_MOSPI_APPROVER', 'REJECTED', 'REJECTED_FINAL', 'RETURNED_FROM_MINISTRY', 'RETURNED_FROM_MOSPI', 'APPROVED')`);
        await queryRunner.query(`ALTER TABLE "ministry_submission" ALTER COLUMN "status" TYPE "public"."ministry_submission_status_enum" USING "status"::"text"::"public"."ministry_submission_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."ministry_submission_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "attached_files" SET DEFAULT '[]'::jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "attached_files" SET DEFAULT '[]'`);
        await queryRunner.query(`CREATE TYPE "public"."ministry_submission_status_enum_old" AS ENUM('DRAFT', 'SUBMITTED_TO_STATE', 'SUBMITTED_TO_MOSPI_REVIEWER', 'SUBMITTED_TO_MOSPI_APPROVER', 'REJECTED', 'REJECTED_FINAL', 'RETURNED_FROM_STATE', 'RETURNED_FROM_MOSPI', 'APPROVED')`);
        await queryRunner.query(`ALTER TABLE "ministry_submission" ALTER COLUMN "status" TYPE "public"."ministry_submission_status_enum_old" USING "status"::"text"::"public"."ministry_submission_status_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."ministry_submission_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."ministry_submission_status_enum_old" RENAME TO "ministry_submission_status_enum"`);
    }

}
