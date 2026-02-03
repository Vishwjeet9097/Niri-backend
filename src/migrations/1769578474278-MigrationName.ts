import { MigrationInterface, QueryRunner } from "typeorm";

export class MigrationName1769578474278 implements MigrationInterface {
    name = 'MigrationName1769578474278'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "ministry_indicator_scores" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "submissionId" uuid NOT NULL, "indicatorCode" character varying NOT NULL, "category" character varying NOT NULL, "score" numeric(10,2) NOT NULL, "maxScore" numeric(10,2) NOT NULL, "calculation" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ca7856f61b9d468aef4e26a0079" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e6eb5a86aeac388d382ae9968a" ON "ministry_indicator_scores" ("submissionId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4d4d98e9a177fdf4bd5ff49e86" ON "ministry_indicator_scores" ("submissionId", "indicatorCode") `);
        await queryRunner.query(`CREATE TABLE "ministry_indicator_score_history" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "submissionId" uuid NOT NULL, "indicatorCode" character varying NOT NULL, "category" character varying NOT NULL, "score" numeric(10,2) NOT NULL, "maxScore" numeric(10,2) NOT NULL, "previousScore" numeric(10,2), "scoreChange" numeric(10,2), "calculation" jsonb NOT NULL, "formDataSnapshot" jsonb, "updatedBy" character varying, "updateReason" character varying, "indicatorStatus" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b693bc67cc3c631f420569d89ac" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2036a933620aeda646f4f3d78d" ON "ministry_indicator_score_history" ("createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_bdc0ab00f1a8d38d3481873f90" ON "ministry_indicator_score_history" ("indicatorCode") `);
        await queryRunner.query(`CREATE INDEX "IDX_8978c7525722e9f2edd7b04c58" ON "ministry_indicator_score_history" ("submissionId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1a462459c0d3162559dba620c3" ON "ministry_indicator_score_history" ("submissionId", "indicatorCode") `);
        await queryRunner.query(`CREATE TABLE "ministry_final_scores" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "submissionId" uuid NOT NULL, "ministryId" character varying NOT NULL, "totalScore" numeric(10,2) NOT NULL, "percentage" numeric(5,2), "scoreBreakdown" jsonb NOT NULL, "calculationMethodology" text NOT NULL, "approvedBy" character varying NOT NULL, "categoryScores" jsonb, "scoringVersion" character varying NOT NULL DEFAULT '1.0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "REL_9d93fe5966eab7d4c10bcc6b0b" UNIQUE ("submissionId"), CONSTRAINT "PK_75706b2af4d4b89af131e8625b3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d58e5d2a8841bce7d671df1815" ON "ministry_final_scores" ("createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_980b7c848d7e74a7e3c506548c" ON "ministry_final_scores" ("totalScore") `);
        await queryRunner.query(`CREATE INDEX "IDX_63b6880eb9e6b800a4c5aeae06" ON "ministry_final_scores" ("ministryId") `);
        await queryRunner.query(`CREATE TABLE "ministry_manual_score_updates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "submissionId" uuid NOT NULL, "indicatorCode" character varying NOT NULL, "category" character varying NOT NULL, "systemScore" numeric(10,2) NOT NULL, "manualUpdatedScore" numeric(10,2) NOT NULL, "maxScore" numeric(10,2) NOT NULL, "updateReason" text NOT NULL, "updatedBy" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c2a2b5b5e69d418e0990df35a5e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5efb48c8854d2ebbf6276419d1" ON "ministry_manual_score_updates" ("createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_841819df41416efcabb192f22c" ON "ministry_manual_score_updates" ("indicatorCode") `);
        await queryRunner.query(`CREATE INDEX "IDX_f61f55186b3e5edcc3c9195725" ON "ministry_manual_score_updates" ("submissionId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d1954b8387a1b7204c7b6d1661" ON "ministry_manual_score_updates" ("submissionId", "indicatorCode") `);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "attached_files" SET DEFAULT '[]'::jsonb`);
        await queryRunner.query(`ALTER TABLE "ministry_final_scores" ADD CONSTRAINT "FK_9d93fe5966eab7d4c10bcc6b0bd" FOREIGN KEY ("submissionId") REFERENCES "ministry_submission"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ministry_final_scores" DROP CONSTRAINT "FK_9d93fe5966eab7d4c10bcc6b0bd"`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "attached_files" SET DEFAULT '[]'`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d1954b8387a1b7204c7b6d1661"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f61f55186b3e5edcc3c9195725"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_841819df41416efcabb192f22c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5efb48c8854d2ebbf6276419d1"`);
        await queryRunner.query(`DROP TABLE "ministry_manual_score_updates"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_63b6880eb9e6b800a4c5aeae06"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_980b7c848d7e74a7e3c506548c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d58e5d2a8841bce7d671df1815"`);
        await queryRunner.query(`DROP TABLE "ministry_final_scores"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1a462459c0d3162559dba620c3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8978c7525722e9f2edd7b04c58"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bdc0ab00f1a8d38d3481873f90"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2036a933620aeda646f4f3d78d"`);
        await queryRunner.query(`DROP TABLE "ministry_indicator_score_history"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4d4d98e9a177fdf4bd5ff49e86"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e6eb5a86aeac388d382ae9968a"`);
        await queryRunner.query(`DROP TABLE "ministry_indicator_scores"`);
    }

}
