import { MigrationInterface, QueryRunner } from "typeorm";

export class MigrationName1767181985282 implements MigrationInterface {
    name = 'MigrationName1767181985282'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "ministry_submission_data" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "submission_indicator_id" character varying NOT NULL, "input_field_id" character varying NOT NULL, "value_text" text, "value_number" numeric(10,2), "value_date" date, "value_json" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_451cb8a1e63fb6279cf2f960dbc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2d1a4c116c201d5458f69bcc24" ON "ministry_submission_data" ("submission_indicator_id", "input_field_id") `);
        // await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "attached_files" SET DEFAULT '[]'::jsonb`);
        // await queryRunner.query(`ALTER TYPE "public"."submissions_current_owner_role_enum" RENAME TO "submissions_current_owner_role_enum_old"`);
        // await queryRunner.query(`CREATE TYPE "public"."submissions_current_owner_role_enum" AS ENUM('NODAL_OFFICER', 'STATE_APPROVER', 'MOSPI_REVIEWER', 'MOSPI_APPROVER', 'ADMIN', 'MINISTRY_APPROVER')`);
        // await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "current_owner_role" DROP DEFAULT`);
        // await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "current_owner_role" TYPE "public"."submissions_current_owner_role_enum" USING "current_owner_role"::"text"::"public"."submissions_current_owner_role_enum"`);
        // await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "current_owner_role" SET DEFAULT 'STATE_APPROVER'`);
        // await queryRunner.query(`DROP TYPE "public"."submissions_current_owner_role_enum_old"`);
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
        await queryRunner.query(`CREATE TYPE "public"."submissions_current_owner_role_enum_old" AS ENUM('NODAL_OFFICER', 'STATE_APPROVER', 'MOSPI_REVIEWER', 'MOSPI_APPROVER', 'ADMIN')`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "current_owner_role" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "current_owner_role" TYPE "public"."submissions_current_owner_role_enum_old" USING "current_owner_role"::"text"::"public"."submissions_current_owner_role_enum_old"`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "current_owner_role" SET DEFAULT 'STATE_APPROVER'`);
        await queryRunner.query(`DROP TYPE "public"."submissions_current_owner_role_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."submissions_current_owner_role_enum_old" RENAME TO "submissions_current_owner_role_enum"`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "attached_files" SET DEFAULT '[]'`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2d1a4c116c201d5458f69bcc24"`);
        await queryRunner.query(`DROP TABLE "ministry_submission_data"`);
    }

}
