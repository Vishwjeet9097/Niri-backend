import { MigrationInterface, QueryRunner } from "typeorm";

export class InitMigration1763023013840 implements MigrationInterface {
    name = 'InitMigration1763023013840'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_indicator_scope" DROP CONSTRAINT "FK_user_indicator_scope_user_id"`);
        await queryRunner.query(`ALTER TABLE "user_indicator_scope" DROP CONSTRAINT "FK_user_indicator_scope_indicator_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_indicators_code"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_indicators_section_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_indicators_category"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_user_indicator_scope_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_user_indicator_scope_indicator_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_user_indicator_scope_unique"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c6e0b588d766a97538e93db0a3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c9e6e8399de7e65f2bbd7cd536"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_states_name"`);
        await queryRunner.query(`CREATE TABLE "submissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "submission_id" character varying NOT NULL, "stateUt" character varying NOT NULL, "submitted_by" uuid NOT NULL, "rejection_count" integer NOT NULL DEFAULT '0', "form_data" jsonb, "review_comments" jsonb NOT NULL DEFAULT '[]', "indicator_comment" jsonb NOT NULL DEFAULT '{}', "attached_files" jsonb DEFAULT '[]'::jsonb, "status" "public"."submissions_status_enum" NOT NULL DEFAULT 'SUBMITTED_TO_STATE', "current_owner_role" "public"."submissions_current_owner_role_enum" NOT NULL DEFAULT 'STATE_APPROVER', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_9d2b514f747142635edb10c1d3d" UNIQUE ("submission_id"), CONSTRAINT "PK_10b3be95b8b2fb1e482e07d706b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7f2dd4f380d2902d0562e2f886" ON "submissions" ("current_owner_role") `);
        await queryRunner.query(`CREATE INDEX "IDX_d89b2ee682c9475006762b666e" ON "submissions" ("submitted_by") `);
        await queryRunner.query(`CREATE INDEX "IDX_d4842916487f15fcca89b1a918" ON "submissions" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_aab253fd80b0342d52ef2a06be" ON "submissions" ("stateUt") `);
        await queryRunner.query(`ALTER TABLE "user_indicator_scope" DROP COLUMN "is_active"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP CONSTRAINT "UQ_ca086d60022bb24faa3d5b0e413"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP COLUMN "submission_id"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP COLUMN "state_ut"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP COLUMN "total_score"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP COLUMN "score_breakdown"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP COLUMN "calculation_methodology"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP COLUMN "approved_by"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP COLUMN "category_scores"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP COLUMN "scoring_version"`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD "submissionId" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD CONSTRAINT "UQ_0380475c5f8966ba2d11ee77bd5" UNIQUE ("submissionId")`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD "stateUt" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD "totalScore" numeric(10,2) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD "scoreBreakdown" jsonb NOT NULL`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD "calculationMethodology" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD "approvedBy" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD "categoryScores" jsonb`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD "scoringVersion" character varying NOT NULL DEFAULT '2.0'`);
        await queryRunner.query(`ALTER TABLE "states" ALTER COLUMN "code" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "states" ADD CONSTRAINT "UQ_b8af4194277281dcfe08be42643" UNIQUE ("code")`);
        await queryRunner.query(`CREATE INDEX "IDX_98bbd4b61a123a3464e6a4b9e6" ON "final_scores" ("totalScore") `);
        await queryRunner.query(`CREATE INDEX "IDX_cb1a1bedcecd9a2032fa5f91c5" ON "final_scores" ("stateUt") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_b8af4194277281dcfe08be4264" ON "states" ("code") `);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD CONSTRAINT "FK_0380475c5f8966ba2d11ee77bd5" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "submissions" ADD CONSTRAINT "FK_d89b2ee682c9475006762b666ef" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "submissions" DROP CONSTRAINT "FK_d89b2ee682c9475006762b666ef"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP CONSTRAINT "FK_0380475c5f8966ba2d11ee77bd5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b8af4194277281dcfe08be4264"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cb1a1bedcecd9a2032fa5f91c5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_98bbd4b61a123a3464e6a4b9e6"`);
        await queryRunner.query(`ALTER TABLE "states" DROP CONSTRAINT "UQ_b8af4194277281dcfe08be42643"`);
        await queryRunner.query(`ALTER TABLE "states" ALTER COLUMN "code" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP COLUMN "scoringVersion"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP COLUMN "categoryScores"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP COLUMN "approvedBy"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP COLUMN "calculationMethodology"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP COLUMN "scoreBreakdown"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP COLUMN "totalScore"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP COLUMN "stateUt"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP CONSTRAINT "UQ_0380475c5f8966ba2d11ee77bd5"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP COLUMN "submissionId"`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD "scoring_version" character varying NOT NULL DEFAULT '2.0'`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD "category_scores" jsonb`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD "approved_by" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD "calculation_methodology" text NOT NULL`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD "score_breakdown" jsonb NOT NULL`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD "total_score" numeric(10,2) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD "state_ut" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD "submission_id" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD CONSTRAINT "UQ_ca086d60022bb24faa3d5b0e413" UNIQUE ("submission_id")`);
        await queryRunner.query(`ALTER TABLE "user_indicator_scope" ADD "is_active" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`DROP INDEX "public"."IDX_aab253fd80b0342d52ef2a06be"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d4842916487f15fcca89b1a918"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d89b2ee682c9475006762b666e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7f2dd4f380d2902d0562e2f886"`);
        await queryRunner.query(`DROP TABLE "submissions"`);
        await queryRunner.query(`CREATE INDEX "IDX_states_name" ON "states" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_c9e6e8399de7e65f2bbd7cd536" ON "final_scores" ("state_ut") `);
        await queryRunner.query(`CREATE INDEX "IDX_c6e0b588d766a97538e93db0a3" ON "final_scores" ("total_score") `);
        await queryRunner.query(`CREATE INDEX "IDX_user_indicator_scope_unique" ON "user_indicator_scope" ("indicator_id", "user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_user_indicator_scope_indicator_id" ON "user_indicator_scope" ("indicator_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_user_indicator_scope_user_id" ON "user_indicator_scope" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_indicators_category" ON "indicators" ("category") `);
        await queryRunner.query(`CREATE INDEX "IDX_indicators_section_id" ON "indicators" ("section_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_indicators_code" ON "indicators" ("code") `);
        await queryRunner.query(`ALTER TABLE "user_indicator_scope" ADD CONSTRAINT "FK_user_indicator_scope_indicator_id" FOREIGN KEY ("indicator_id") REFERENCES "indicators"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_indicator_scope" ADD CONSTRAINT "FK_user_indicator_scope_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
