import { MigrationInterface, QueryRunner } from "typeorm";

export class MigrationName1767698121911 implements MigrationInterface {
    name = 'MigrationName1767698121911'

    public async up(queryRunner: QueryRunner): Promise<void> {
         await queryRunner.query(`ALTER TYPE "public"."ministry_form_status_enum" RENAME TO "ministry_form_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."ministry_form_status_enum" AS ENUM('DRAFT', 'SUBMITTED_TO_MOSPI_REVIEWER', 'SUBMITTED_TO_MOSPI_APPROVER', 'RETURNED_FROM_MOSPI', 'ACCEPTED_BY_MOSPI')`);
         await queryRunner.query(`ALTER TABLE "ministry_form" ALTER COLUMN "status" TYPE "public"."ministry_form_status_enum" USING "status"::"text"::"public"."ministry_form_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."ministry_form_status_enum_old"`);
        // await queryRunner.query(`ALTER TYPE "public"."ministry_input_fields_ui_component_enum" RENAME TO "ministry_input_fields_ui_component_enum_old"`);
        // await queryRunner.query(`CREATE TYPE "public"."ministry_input_fields_ui_component_enum" AS ENUM('Input (Text)', 'Input (Number)', 'Dropdown', 'Auto-calculated field', 'File', 'Checkbox', 'Text Area', 'Radio Button')`);
        // await queryRunner.query(`ALTER TABLE "ministry_input_fields" ALTER COLUMN "ui_component" DROP DEFAULT`);
        // await queryRunner.query(`ALTER TABLE "ministry_input_fields" ALTER COLUMN "ui_component" TYPE "public"."ministry_input_fields_ui_component_enum" USING "ui_component"::"text"::"public"."ministry_input_fields_ui_component_enum"`);
        // await queryRunner.query(`ALTER TABLE "ministry_input_fields" ALTER COLUMN "ui_component" SET DEFAULT 'Input (Text)'`);
        // await queryRunner.query(`DROP TYPE "public"."ministry_input_fields_ui_component_enum_old"`);
        // await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "attached_files" SET DEFAULT '[]'::jsonb`);
        // await queryRunner.query(`ALTER TYPE "public"."submissions_current_owner_role_enum_old" RENAME TO "submissions_current_owner_role_enum_old_old"`);
        // await queryRunner.query(`CREATE TYPE "public"."submissions_current_owner_role_enum" AS ENUM('NODAL_OFFICER', 'STATE_APPROVER', 'MOSPI_REVIEWER', 'MOSPI_APPROVER', 'ADMIN', 'MINISTRY_APPROVER')`);
        // await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "current_owner_role" DROP DEFAULT`);
        // await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "current_owner_role" TYPE "public"."submissions_current_owner_role_enum" USING "current_owner_role"::"text"::"public"."submissions_current_owner_role_enum"`);
        // await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "current_owner_role" SET DEFAULT 'STATE_APPROVER'`);
        // await queryRunner.query(`DROP TYPE "public"."submissions_current_owner_role_enum_old_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."submissions_current_owner_role_enum_old_old" AS ENUM('NODAL_OFFICER', 'STATE_APPROVER', 'MOSPI_REVIEWER', 'MOSPI_APPROVER', 'ADMIN', 'MINISTRY_APPROVER')`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "current_owner_role" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "current_owner_role" TYPE "public"."submissions_current_owner_role_enum_old_old" USING "current_owner_role"::"text"::"public"."submissions_current_owner_role_enum_old_old"`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "current_owner_role" SET DEFAULT 'STATE_APPROVER'`);
        await queryRunner.query(`DROP TYPE "public"."submissions_current_owner_role_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."submissions_current_owner_role_enum_old_old" RENAME TO "submissions_current_owner_role_enum_old"`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "attached_files" SET DEFAULT '[]'`);
        await queryRunner.query(`CREATE TYPE "public"."ministry_input_fields_ui_component_enum_old" AS ENUM('Input (Text)', 'Input (Number)', 'Dropdown', 'Auto-calculated field', 'File', 'Checkbox', 'Text Area')`);
        await queryRunner.query(`ALTER TABLE "ministry_input_fields" ALTER COLUMN "ui_component" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "ministry_input_fields" ALTER COLUMN "ui_component" TYPE "public"."ministry_input_fields_ui_component_enum_old" USING "ui_component"::"text"::"public"."ministry_input_fields_ui_component_enum_old"`);
        await queryRunner.query(`ALTER TABLE "ministry_input_fields" ALTER COLUMN "ui_component" SET DEFAULT 'Input (Text)'`);
        await queryRunner.query(`DROP TYPE "public"."ministry_input_fields_ui_component_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."ministry_input_fields_ui_component_enum_old" RENAME TO "ministry_input_fields_ui_component_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."ministry_form_status_enum_old" AS ENUM('DRAFT', 'SUBMITTED_TO_MOSPI', 'RETURNED_FROM_MOSPI', 'ACCEPTED_BY_MOSPI')`);
        await queryRunner.query(`ALTER TABLE "ministry_form" ALTER COLUMN "status" TYPE "public"."ministry_form_status_enum_old" USING "status"::"text"::"public"."ministry_form_status_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."ministry_form_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."ministry_form_status_enum_old" RENAME TO "ministry_form_status_enum"`);
    }

}
