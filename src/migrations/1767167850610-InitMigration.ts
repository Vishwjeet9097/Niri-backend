import { MigrationInterface, QueryRunner } from "typeorm";

export class InitMigration1767167850610 implements MigrationInterface {
    name = 'InitMigration1767167850610'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."ministry_input_fields_ui_component_enum" AS ENUM('Input (Text)', 'Input (Number)', 'Dropdown', 'Auto-calculated field', 'File', 'Checkbox', 'Text Area')`);
        await queryRunner.query(`ALTER TABLE "ministry_input_fields" ADD "ui_component" "public"."ministry_input_fields_ui_component_enum" NOT NULL DEFAULT 'Input (Text)'`);
        await queryRunner.query(`ALTER TYPE "public"."ministry_input_fields_data_type_enum" RENAME TO "ministry_input_fields_data_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."ministry_input_fields_data_type_enum" AS ENUM('number', 'file', 'string')`);
        await queryRunner.query(`ALTER TABLE "ministry_input_fields" ALTER COLUMN "data_type" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "ministry_input_fields" ALTER COLUMN "data_type" TYPE "public"."ministry_input_fields_data_type_enum" USING "data_type"::"text"::"public"."ministry_input_fields_data_type_enum"`);
        await queryRunner.query(`ALTER TABLE "ministry_input_fields" ALTER COLUMN "data_type" SET DEFAULT 'string'`);
        await queryRunner.query(`DROP TYPE "public"."ministry_input_fields_data_type_enum_old"`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "attached_files" SET DEFAULT '[]'::jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
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
