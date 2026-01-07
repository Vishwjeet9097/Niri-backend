import { MigrationInterface, QueryRunner } from "typeorm";

export class InitMigration1767345232349 implements MigrationInterface {
    name = 'InitMigration1767345232349'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "ministry_submission_data" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "submission_indicator_id" character varying NOT NULL, "input_field_id" character varying NOT NULL, "value_text" text, "value_number" numeric(10,2), "value_date" date, "value_json" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_451cb8a1e63fb6279cf2f960dbc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2d1a4c116c201d5458f69bcc24" ON "ministry_submission_data" ("submission_indicator_id", "input_field_id") `);
        await queryRunner.query(`ALTER TABLE "ministry_submission_indicator" ADD "ministry_user" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "attached_files" SET DEFAULT '[]'::jsonb`);
        await queryRunner.query(`ALTER TABLE "ministry_submission_indicator" DROP COLUMN "status"`);
        await queryRunner.query(`CREATE TYPE "public"."ministry_submission_indicator_status_enum" AS ENUM('DRAFT', 'ACCEPTED', 'REVERTED', 'RESUBMITTED', 'RETURNED_FROM_MOSPI')`);
        await queryRunner.query(`ALTER TABLE "ministry_submission_indicator" ADD "status" "public"."ministry_submission_indicator_status_enum"`);
        await queryRunner.query(`CREATE INDEX "IDX_399ad99395799466ba55d5724a" ON "ministry_submission_indicator" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_374aacc77c1a2b28bbe7e16ffe" ON "ministry_submission_indicator" ("ministry_user") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_374aacc77c1a2b28bbe7e16ffe"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_399ad99395799466ba55d5724a"`);
        await queryRunner.query(`ALTER TABLE "ministry_submission_indicator" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."ministry_submission_indicator_status_enum"`);
        await queryRunner.query(`ALTER TABLE "ministry_submission_indicator" ADD "status" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "attached_files" SET DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "ministry_submission_indicator" DROP COLUMN "ministry_user"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2d1a4c116c201d5458f69bcc24"`);
        await queryRunner.query(`DROP TABLE "ministry_submission_data"`);
    }

}
