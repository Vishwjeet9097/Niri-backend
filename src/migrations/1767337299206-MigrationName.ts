import { MigrationInterface, QueryRunner } from "typeorm";

export class MigrationName1767337299206 implements MigrationInterface {
    name = 'MigrationName1767337299206'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ministry_submission_indicator" ADD "ministry_user" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "attached_files" SET DEFAULT '[]'::jsonb`);
        await queryRunner.query(`ALTER TYPE "public"."submissions_current_owner_role_enum" RENAME TO "submissions_current_owner_role_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."submissions_current_owner_role_enum" AS ENUM('NODAL_OFFICER', 'STATE_APPROVER', 'MOSPI_REVIEWER', 'MOSPI_APPROVER', 'ADMIN', 'MINISTRY_APPROVER')`);
        // await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "current_owner_role" DROP DEFAULT`);
        // await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "current_owner_role" TYPE "public"."submissions_current_owner_role_enum" USING "current_owner_role"::"text"::"public"."submissions_current_owner_role_enum"`);
        // await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "current_owner_role" SET DEFAULT 'STATE_APPROVER'`);
        // await queryRunner.query(`DROP TYPE "public"."submissions_current_owner_role_enum_old"`);
        await queryRunner.query(`ALTER TABLE "ministry_submission_indicator" DROP COLUMN "status"`);
        await queryRunner.query(`CREATE TYPE "public"."ministry_submission_indicator_status_enum" AS ENUM('DRAFT', 'ACCEPTED', 'REVERTED', 'RESUBMITTED', 'RETURNED_FROM_MOSPI')`);
        await queryRunner.query(`ALTER TABLE "ministry_submission_indicator" ADD "status" "public"."ministry_submission_indicator_status_enum"`);
        //await queryRunner.query(`ALTER TABLE "states" ALTER COLUMN "code" SET NOT NULL`);
        // await queryRunner.query(`ALTER TYPE "public"."audit_logs_userrole_enum" RENAME TO "audit_logs_userrole_enum_old"`);
        // await queryRunner.query(`CREATE TYPE "public"."audit_logs_userrole_enum" AS ENUM('NODAL_OFFICER', 'STATE_APPROVER', 'MOSPI_REVIEWER', 'MOSPI_APPROVER', 'ADMIN', 'MINISTRY_APPROVER')`);
        // await queryRunner.query(`ALTER TABLE "audit_logs" ALTER COLUMN "userRole" TYPE "public"."audit_logs_userrole_enum" USING "userRole"::"text"::"public"."audit_logs_userrole_enum"`);
        // await queryRunner.query(`DROP TYPE "public"."audit_logs_userrole_enum_old"`);
        await queryRunner.query(`CREATE INDEX "IDX_399ad99395799466ba55d5724a" ON "ministry_submission_indicator" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_374aacc77c1a2b28bbe7e16ffe" ON "ministry_submission_indicator" ("ministry_user") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_374aacc77c1a2b28bbe7e16ffe"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_399ad99395799466ba55d5724a"`);
        await queryRunner.query(`CREATE TYPE "public"."audit_logs_userrole_enum_old" AS ENUM('NODAL_OFFICER', 'STATE_APPROVER', 'MOSPI_REVIEWER', 'MOSPI_APPROVER', 'ADMIN')`);
        await queryRunner.query(`ALTER TABLE "audit_logs" ALTER COLUMN "userRole" TYPE "public"."audit_logs_userrole_enum_old" USING "userRole"::"text"::"public"."audit_logs_userrole_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."audit_logs_userrole_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."audit_logs_userrole_enum_old" RENAME TO "audit_logs_userrole_enum"`);
        await queryRunner.query(`ALTER TABLE "states" ALTER COLUMN "code" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "ministry_submission_indicator" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."ministry_submission_indicator_status_enum"`);
        await queryRunner.query(`ALTER TABLE "ministry_submission_indicator" ADD "status" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`CREATE TYPE "public"."submissions_current_owner_role_enum_old" AS ENUM('NODAL_OFFICER', 'STATE_APPROVER', 'MOSPI_REVIEWER', 'MOSPI_APPROVER', 'ADMIN')`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "current_owner_role" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "current_owner_role" TYPE "public"."submissions_current_owner_role_enum_old" USING "current_owner_role"::"text"::"public"."submissions_current_owner_role_enum_old"`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "current_owner_role" SET DEFAULT 'STATE_APPROVER'`);
        await queryRunner.query(`DROP TYPE "public"."submissions_current_owner_role_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."submissions_current_owner_role_enum_old" RENAME TO "submissions_current_owner_role_enum"`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "attached_files" SET DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "ministry_submission_indicator" DROP COLUMN "ministry_user"`);
    }

}
