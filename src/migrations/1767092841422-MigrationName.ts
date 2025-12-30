import { MigrationInterface, QueryRunner } from "typeorm";

export class MigrationName1767092841422 implements MigrationInterface {
    name = 'MigrationName1767092841422'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."ministry_input_fields_ui_component_enum" AS ENUM('Input (Text)', 'Input (Number)', 'Dropdown', 'Auto-calculated field', 'File', 'Checkbox', 'Text Area')`);
        await queryRunner.query(`ALTER TABLE "ministry_input_fields" ADD "ui_component" "public"."ministry_input_fields_ui_component_enum" NOT NULL DEFAULT 'Input (Text)'`);
        await queryRunner.query(`ALTER TYPE "public"."ministry_input_fields_data_type_enum" RENAME TO "ministry_input_fields_data_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."ministry_input_fields_data_type_enum" AS ENUM('number', 'file', 'string')`);
        await queryRunner.query(`ALTER TABLE "ministry_input_fields" ALTER COLUMN "data_type" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "ministry_input_fields" ALTER COLUMN "data_type" TYPE "public"."ministry_input_fields_data_type_enum" USING "data_type"::"text"::"public"."ministry_input_fields_data_type_enum"`);
        await queryRunner.query(`ALTER TABLE "ministry_input_fields" ALTER COLUMN "data_type" SET DEFAULT 'string'`);
        await queryRunner.query(`DROP TYPE "public"."ministry_input_fields_data_type_enum_old"`);
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
        await queryRunner.query(`CREATE TYPE "public"."ministry_input_fields_data_type_enum_old" AS ENUM('number', 'file', 'string', 'dropdown')`);
        await queryRunner.query(`ALTER TABLE "ministry_input_fields" ALTER COLUMN "data_type" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "ministry_input_fields" ALTER COLUMN "data_type" TYPE "public"."ministry_input_fields_data_type_enum_old" USING "data_type"::"text"::"public"."ministry_input_fields_data_type_enum_old"`);
        await queryRunner.query(`ALTER TABLE "ministry_input_fields" ALTER COLUMN "data_type" SET DEFAULT 'string'`);
        await queryRunner.query(`DROP TYPE "public"."ministry_input_fields_data_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."ministry_input_fields_data_type_enum_old" RENAME TO "ministry_input_fields_data_type_enum"`);
        await queryRunner.query(`ALTER TABLE "ministry_input_fields" DROP COLUMN "ui_component"`);
        await queryRunner.query(`DROP TYPE "public"."ministry_input_fields_ui_component_enum"`);
    }

}
