import { MigrationInterface, QueryRunner } from "typeorm";

export class MigrationName1768474963455 implements MigrationInterface {
    name = 'MigrationName1768474963455'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."ministry_submission_status_enum" RENAME TO "ministry_submission_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."ministry_submission_status_enum" AS ENUM('DRAFT', 'SUBMITTED_TO_MINISTRY', 'SUBMITTED_TO_MOSPI_REVIEWER', 'SUBMITTED_TO_MOSPI_APPROVER', 'REJECTED', 'REJECTED_FINAL', 'RETURNED_FROM_MINISTRY', 'RETURNED_FROM_MOSPI_APPROVER', 'APPROVED')`);
        await queryRunner.query(`ALTER TABLE "ministry_submission" ALTER COLUMN "status" TYPE "public"."ministry_submission_status_enum" USING "status"::"text"::"public"."ministry_submission_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."ministry_submission_status_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."ministry_submission_indicator_status_enum" RENAME TO "ministry_submission_indicator_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."ministry_submission_indicator_status_enum" AS ENUM('DRAFT', 'ACCEPTED', 'REVERTED', 'RESUBMITTED', 'SUBMITTED_TO_MINISTRY', 'ACCEPTED_BY_MINISTRY', 'ACCEPTED_BY_MOSPI', 'RETURNED_FROM_MINISTRY', 'RETURNED_FROM_MOSPI', 'RETURNED_FROM_MOSPI_APPROVER_DRAFT', 'ACCEPTED_BY_MOSPI_APPROVER_DRAFT', 'RETURNED_FROM_MOSPI_APPROVER', 'SUBMITTED_TO_MOSPI')`);
        await queryRunner.query(`ALTER TABLE "ministry_submission_indicator" ALTER COLUMN "status" TYPE "public"."ministry_submission_indicator_status_enum" USING "status"::"text"::"public"."ministry_submission_indicator_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."ministry_submission_indicator_status_enum_old"`);
        // await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "attached_files" SET DEFAULT '[]'::jsonb`);
        // await queryRunner.query(`ALTER TYPE "public"."submissions_current_owner_role_enum_old" RENAME TO "submissions_current_owner_role_enum_old_old"`);
        // await queryRunner.query(`CREATE TYPE "public"."submissions_current_owner_role_enum" AS ENUM('NODAL_OFFICER', 'STATE_APPROVER', 'MOSPI_REVIEWER', 'MOSPI_APPROVER', 'ADMIN', 'MINISTRY_APPROVER')`);
        // await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "current_owner_role" DROP DEFAULT`);
        // await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "current_owner_role" TYPE "public"."submissions_current_owner_role_enum" USING "current_owner_role"::"text"::"public"."submissions_current_owner_role_enum"`);
        // await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "current_owner_role" SET DEFAULT 'STATE_APPROVER'`);
        // await queryRunner.query(`DROP TYPE "public"."submissions_current_owner_role_enum_old_old"`);
        // await queryRunner.query(`ALTER TABLE "states" ALTER COLUMN "code" SET NOT NULL`);
        // await queryRunner.query(`ALTER TYPE "public"."audit_logs_userrole_enum" RENAME TO "audit_logs_userrole_enum_old"`);
        // await queryRunner.query(`CREATE TYPE "public"."audit_logs_userrole_enum" AS ENUM('NODAL_OFFICER', 'STATE_APPROVER', 'MOSPI_REVIEWER', 'MOSPI_APPROVER', 'ADMIN', 'MINISTRY_APPROVER')`);
        // await queryRunner.query(`ALTER TABLE "audit_logs" ALTER COLUMN "userRole" TYPE "public"."audit_logs_userrole_enum" USING "userRole"::"text"::"public"."audit_logs_userrole_enum"`);
        // await queryRunner.query(`DROP TYPE "public"."audit_logs_userrole_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."audit_logs_userrole_enum_old" AS ENUM('NODAL_OFFICER', 'STATE_APPROVER', 'MOSPI_REVIEWER', 'MOSPI_APPROVER', 'ADMIN')`);
        await queryRunner.query(`ALTER TABLE "audit_logs" ALTER COLUMN "userRole" TYPE "public"."audit_logs_userrole_enum_old" USING "userRole"::"text"::"public"."audit_logs_userrole_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."audit_logs_userrole_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."audit_logs_userrole_enum_old" RENAME TO "audit_logs_userrole_enum"`);
        await queryRunner.query(`ALTER TABLE "states" ALTER COLUMN "code" DROP NOT NULL`);
        await queryRunner.query(`CREATE TYPE "public"."submissions_current_owner_role_enum_old_old" AS ENUM('NODAL_OFFICER', 'STATE_APPROVER', 'MOSPI_REVIEWER', 'MOSPI_APPROVER', 'ADMIN')`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "current_owner_role" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "current_owner_role" TYPE "public"."submissions_current_owner_role_enum_old_old" USING "current_owner_role"::"text"::"public"."submissions_current_owner_role_enum_old_old"`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "current_owner_role" SET DEFAULT 'STATE_APPROVER'`);
        await queryRunner.query(`DROP TYPE "public"."submissions_current_owner_role_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."submissions_current_owner_role_enum_old_old" RENAME TO "submissions_current_owner_role_enum_old"`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "attached_files" SET DEFAULT '[]'`);
        await queryRunner.query(`CREATE TYPE "public"."ministry_submission_indicator_status_enum_old" AS ENUM('DRAFT', 'ACCEPTED', 'REVERTED', 'RESUBMITTED', 'SUBMITTED_TO_MINISTRY', 'ACCEPTED_BY_MINISTRY', 'ACCEPTED_BY_MOSPI', 'RETURNED_FROM_MINISTRY', 'RETURNED_FROM_MOSPI', 'SUBMITTED_TO_MOSPI')`);
        await queryRunner.query(`ALTER TABLE "ministry_submission_indicator" ALTER COLUMN "status" TYPE "public"."ministry_submission_indicator_status_enum_old" USING "status"::"text"::"public"."ministry_submission_indicator_status_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."ministry_submission_indicator_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."ministry_submission_indicator_status_enum_old" RENAME TO "ministry_submission_indicator_status_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."ministry_submission_status_enum_old" AS ENUM('DRAFT', 'SUBMITTED_TO_MINISTRY', 'SUBMITTED_TO_MOSPI_REVIEWER', 'SUBMITTED_TO_MOSPI_APPROVER', 'REJECTED', 'REJECTED_FINAL', 'RETURNED_FROM_MINISTRY', 'RETURNED_FROM_MOSPI', 'APPROVED')`);
        await queryRunner.query(`ALTER TABLE "ministry_submission" ALTER COLUMN "status" TYPE "public"."ministry_submission_status_enum_old" USING "status"::"text"::"public"."ministry_submission_status_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."ministry_submission_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."ministry_submission_status_enum_old" RENAME TO "ministry_submission_status_enum"`);
    }

}
