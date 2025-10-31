import { MigrationInterface, QueryRunner } from "typeorm";

export class InitMigration1761826204758 implements MigrationInterface {
    name = 'InitMigration1761826204758'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "final_scores" DROP CONSTRAINT "FK_ca086d60022bb24faa3d5b0e413"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c6e0b588d766a97538e93db0a3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c9e6e8399de7e65f2bbd7cd536"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d04393e1f9bd8d7261f4c0a16f"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP CONSTRAINT "REL_ca086d60022bb24faa3d5b0e41"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP COLUMN "submission_id"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP COLUMN "state_ut"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP COLUMN "total_score"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP COLUMN "score_breakdown"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP COLUMN "calculation_methodology"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP COLUMN "approved_by"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP COLUMN "category_scores"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP COLUMN "scoring_version"`);
        await queryRunner.query(`ALTER TABLE "submissions" DROP COLUMN "state_ut"`);
        await queryRunner.query(`ALTER TABLE "submissions" DROP COLUMN "indicatorComment"`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD "submissionId" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD CONSTRAINT "UQ_0380475c5f8966ba2d11ee77bd5" UNIQUE ("submissionId")`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD "stateUt" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD "totalScore" numeric(10,2) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD "scoreBreakdown" jsonb NOT NULL`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD "calculationMethodology" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD "approvedBy" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD "categoryScores" jsonb`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD "scoringVersion" character varying NOT NULL DEFAULT '2.0'`);
        await queryRunner.query(`ALTER TABLE "submissions" ADD "stateUt" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "attached_files" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "attached_files" SET DEFAULT '[]'::jsonb`);
        await queryRunner.query(`CREATE INDEX "IDX_98bbd4b61a123a3464e6a4b9e6" ON "final_scores" ("totalScore") `);
        await queryRunner.query(`CREATE INDEX "IDX_cb1a1bedcecd9a2032fa5f91c5" ON "final_scores" ("stateUt") `);
        await queryRunner.query(`CREATE INDEX "IDX_aab253fd80b0342d52ef2a06be" ON "submissions" ("stateUt") `);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD CONSTRAINT "FK_0380475c5f8966ba2d11ee77bd5" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "final_scores" DROP CONSTRAINT "FK_0380475c5f8966ba2d11ee77bd5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_aab253fd80b0342d52ef2a06be"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cb1a1bedcecd9a2032fa5f91c5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_98bbd4b61a123a3464e6a4b9e6"`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "attached_files" SET DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "attached_files" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "submissions" DROP COLUMN "stateUt"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP COLUMN "scoringVersion"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP COLUMN "categoryScores"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP COLUMN "approvedBy"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP COLUMN "calculationMethodology"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP COLUMN "scoreBreakdown"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP COLUMN "totalScore"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP COLUMN "stateUt"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP CONSTRAINT "UQ_0380475c5f8966ba2d11ee77bd5"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP COLUMN "submissionId"`);
        await queryRunner.query(`ALTER TABLE "submissions" ADD "indicatorComment" jsonb DEFAULT '{}'`);
        await queryRunner.query(`ALTER TABLE "submissions" ADD "state_ut" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD "scoring_version" character varying NOT NULL DEFAULT '2.0'`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD "category_scores" jsonb`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD "approved_by" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD "calculation_methodology" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD "score_breakdown" jsonb NOT NULL`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD "total_score" numeric(10,2) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD "state_ut" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD "submission_id" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD CONSTRAINT "REL_ca086d60022bb24faa3d5b0e41" UNIQUE ("submission_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_d04393e1f9bd8d7261f4c0a16f" ON "submissions" ("state_ut") `);
        await queryRunner.query(`CREATE INDEX "IDX_c9e6e8399de7e65f2bbd7cd536" ON "final_scores" ("state_ut") `);
        await queryRunner.query(`CREATE INDEX "IDX_c6e0b588d766a97538e93db0a3" ON "final_scores" ("total_score") `);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD CONSTRAINT "FK_ca086d60022bb24faa3d5b0e413" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
