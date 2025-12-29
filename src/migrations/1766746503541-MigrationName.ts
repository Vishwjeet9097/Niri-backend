import { MigrationInterface, QueryRunner } from "typeorm";

export class MigrationName1766746503541 implements MigrationInterface {
    name = 'MigrationName1766746503541'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."ministry_submission_status_enum" AS ENUM('DRAFT', 'SUBMITTED_TO_STATE', 'SUBMITTED_TO_MOSPI_REVIEWER', 'SUBMITTED_TO_MOSPI_APPROVER', 'REJECTED', 'REJECTED_FINAL', 'RETURNED_FROM_STATE', 'RETURNED_FROM_MOSPI', 'APPROVED')`);
        await queryRunner.query(`CREATE TABLE "ministry_submission" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "submission_id" character varying NOT NULL, "form_id" character varying NOT NULL, "user_id" character varying NOT NULL, "status" "public"."ministry_submission_status_enum" NOT NULL DEFAULT 'DRAFT', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_362baf09bdb8ed09692bcf53e35" UNIQUE ("submission_id"), CONSTRAINT "PK_6871d2a135d509c99a90c7263e7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_79b22cf00d58bd904ccc9c26e0" ON "ministry_submission" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_5493a6d101dc3dac38bce42f8b" ON "ministry_submission" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_38fc94220303a76b4d222a83b7" ON "ministry_submission" ("form_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_362baf09bdb8ed09692bcf53e3" ON "ministry_submission" ("submission_id") `);
        await queryRunner.query(`CREATE TABLE "ministry_submission_indicator" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "submission_id" character varying NOT NULL, "indicator_id" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_61710153c626781a12502541d03" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_62b3dfcbd06b2c6bbe510db013" ON "ministry_submission_indicator" ("submission_id", "indicator_id") `);
       // await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "attached_files" SET DEFAULT '[]'::jsonb`);
       // await queryRunner.query(`ALTER TABLE "states" ALTER COLUMN "code" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "states" ALTER COLUMN "code" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "attached_files" SET DEFAULT '[]'`);
        await queryRunner.query(`DROP INDEX "public"."IDX_62b3dfcbd06b2c6bbe510db013"`);
        await queryRunner.query(`DROP TABLE "ministry_submission_indicator"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_362baf09bdb8ed09692bcf53e3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_38fc94220303a76b4d222a83b7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5493a6d101dc3dac38bce42f8b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_79b22cf00d58bd904ccc9c26e0"`);
        await queryRunner.query(`DROP TABLE "ministry_submission"`);
        await queryRunner.query(`DROP TYPE "public"."ministry_submission_status_enum"`);
    }

}
