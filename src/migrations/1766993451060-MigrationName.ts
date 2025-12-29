import { MigrationInterface, QueryRunner } from "typeorm";

export class MigrationName1766993451060 implements MigrationInterface {
    name = 'MigrationName1766993451060'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ministry_form" ADD "year" integer`);
        await queryRunner.query(`ALTER TABLE "ministry_form" ADD "ministry" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "ministry_form" ADD "reviewer" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "ministry_submission_indicator" ADD "status" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "ministry_submission_indicator" ADD "assigned_to" character varying(255)`);
        //await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "attached_files" SET DEFAULT '[]'::jsonb`);
        //await queryRunner.query(`ALTER TABLE "states" ALTER COLUMN "code" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "states" ALTER COLUMN "code" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "attached_files" SET DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "ministry_submission_indicator" DROP COLUMN "assigned_to"`);
        await queryRunner.query(`ALTER TABLE "ministry_submission_indicator" DROP COLUMN "status"`);
        await queryRunner.query(`ALTER TABLE "ministry_form" DROP COLUMN "reviewer"`);
        await queryRunner.query(`ALTER TABLE "ministry_form" DROP COLUMN "ministry"`);
        await queryRunner.query(`ALTER TABLE "ministry_form" DROP COLUMN "year"`);
    }

}
