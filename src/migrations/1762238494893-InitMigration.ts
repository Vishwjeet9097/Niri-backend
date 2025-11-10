import { MigrationInterface, QueryRunner } from "typeorm";

export class InitMigration1762238494893 implements MigrationInterface {
    name = 'InitMigration1762238494893'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('NODAL_OFFICER', 'STATE_APPROVER', 'MOSPI_REVIEWER', 'MOSPI_APPROVER', 'ADMIN')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "password" character varying NOT NULL, "firstName" character varying NOT NULL, "lastName" character varying NOT NULL, "contactNumber" character varying, "role" "public"."users_role_enum" NOT NULL, "state_ut" character varying NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7427b2da8bae1e61c3c1e9ee10" ON "users" ("state_ut", "role") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
        await queryRunner.query(`CREATE TABLE "indicators" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying NOT NULL, "section_id" character varying NOT NULL, "indicator_name" character varying NOT NULL, "max_score" numeric(10,2) NOT NULL, "category" character varying NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_7908c77362d20f1c428d49bfe4b" UNIQUE ("code"), CONSTRAINT "PK_6e24383c110600564187e92042e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c953c376bf505e75316a1fc02e" ON "indicators" ("section_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_7908c77362d20f1c428d49bfe4" ON "indicators" ("code") `);
        await queryRunner.query(`CREATE TABLE "user_indicator_scope" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "indicator_id" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_2f44485d8f4c6d07fae3efaf67d" UNIQUE ("user_id", "indicator_id"), CONSTRAINT "PK_088f79ecd767eb679e67d6ccdc3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_4e50b495261d79866cad4e35cf" ON "user_indicator_scope" ("indicator_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_472a74351fd6e1a88235aaf30e" ON "user_indicator_scope" ("user_id") `);
        await queryRunner.query(`CREATE TABLE "final_scores" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "submissionId" uuid NOT NULL, "stateUt" character varying NOT NULL, "totalScore" numeric(10,2) NOT NULL, "percentage" numeric(5,2), "scoreBreakdown" jsonb NOT NULL, "calculationMethodology" text NOT NULL, "approvedBy" character varying NOT NULL, "categoryScores" jsonb, "scoringVersion" character varying NOT NULL DEFAULT '2.0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "REL_0380475c5f8966ba2d11ee77bd" UNIQUE ("submissionId"), CONSTRAINT "PK_526010129df3c6668c0558cc8b2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_996fcc8d018ec1fe50c42159d8" ON "final_scores" ("createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_98bbd4b61a123a3464e6a4b9e6" ON "final_scores" ("totalScore") `);
        await queryRunner.query(`CREATE INDEX "IDX_cb1a1bedcecd9a2032fa5f91c5" ON "final_scores" ("stateUt") `);
        await queryRunner.query(`CREATE TYPE "public"."submissions_status_enum" AS ENUM('DRAFT', 'SUBMITTED_TO_STATE', 'SUBMITTED_TO_MOSPI_REVIEWER', 'SUBMITTED_TO_MOSPI_APPROVER', 'REJECTED', 'REJECTED_FINAL', 'RETURNED_FROM_STATE', 'RETURNED_FROM_MOSPI', 'APPROVED')`);
        await queryRunner.query(`CREATE TYPE "public"."submissions_current_owner_role_enum" AS ENUM('NODAL_OFFICER', 'STATE_APPROVER', 'MOSPI_REVIEWER', 'MOSPI_APPROVER', 'ADMIN')`);
        await queryRunner.query(`CREATE TABLE "submissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "submission_id" character varying NOT NULL, "stateUt" character varying NOT NULL, "submitted_by" uuid NOT NULL, "rejection_count" integer NOT NULL DEFAULT '0', "form_data" jsonb, "review_comments" jsonb NOT NULL DEFAULT '[]', "indicator_comment" jsonb NOT NULL DEFAULT '{}', "attached_files" jsonb DEFAULT '[]'::jsonb, "status" "public"."submissions_status_enum" NOT NULL DEFAULT 'SUBMITTED_TO_STATE', "current_owner_role" "public"."submissions_current_owner_role_enum" NOT NULL DEFAULT 'STATE_APPROVER', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_9d2b514f747142635edb10c1d3d" UNIQUE ("submission_id"), CONSTRAINT "PK_10b3be95b8b2fb1e482e07d706b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7f2dd4f380d2902d0562e2f886" ON "submissions" ("current_owner_role") `);
        await queryRunner.query(`CREATE INDEX "IDX_d89b2ee682c9475006762b666e" ON "submissions" ("submitted_by") `);
        await queryRunner.query(`CREATE INDEX "IDX_d4842916487f15fcca89b1a918" ON "submissions" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_aab253fd80b0342d52ef2a06be" ON "submissions" ("stateUt") `);
        await queryRunner.query(`CREATE TABLE "states" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying NOT NULL, "name" character varying NOT NULL, "type" character varying(2), "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_b8af4194277281dcfe08be42643" UNIQUE ("code"), CONSTRAINT "PK_09ab30ca0975c02656483265f4f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_b8af4194277281dcfe08be4264" ON "states" ("code") `);
        await queryRunner.query(`CREATE TYPE "public"."audit_logs_userrole_enum" AS ENUM('NODAL_OFFICER', 'STATE_APPROVER', 'MOSPI_REVIEWER', 'MOSPI_APPROVER', 'ADMIN')`);
        await queryRunner.query(`CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "entity_type" character varying NOT NULL, "entity_id" character varying NOT NULL, "user_id" character varying NOT NULL, "userRole" "public"."audit_logs_userrole_enum" NOT NULL, "action" character varying NOT NULL, "oldValues" jsonb, "newValues" jsonb, "ip_address" character varying, "user_agent" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c69efb19bf127c97e6740ad530" ON "audit_logs" ("createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_cee5459245f652b75eb2759b4c" ON "audit_logs" ("action") `);
        await queryRunner.query(`CREATE INDEX "IDX_bd2726fd31b35443f2245b93ba" ON "audit_logs" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_7421efc125d95e413657efa3c6" ON "audit_logs" ("entity_type", "entity_id") `);
        await queryRunner.query(`ALTER TABLE "user_indicator_scope" ADD CONSTRAINT "FK_472a74351fd6e1a88235aaf30ec" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_indicator_scope" ADD CONSTRAINT "FK_4e50b495261d79866cad4e35cfb" FOREIGN KEY ("indicator_id") REFERENCES "indicators"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD CONSTRAINT "FK_0380475c5f8966ba2d11ee77bd5" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "submissions" ADD CONSTRAINT "FK_d89b2ee682c9475006762b666ef" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "submissions" DROP CONSTRAINT "FK_d89b2ee682c9475006762b666ef"`);
        await queryRunner.query(`ALTER TABLE "final_scores" DROP CONSTRAINT "FK_0380475c5f8966ba2d11ee77bd5"`);
        await queryRunner.query(`ALTER TABLE "user_indicator_scope" DROP CONSTRAINT "FK_4e50b495261d79866cad4e35cfb"`);
        await queryRunner.query(`ALTER TABLE "user_indicator_scope" DROP CONSTRAINT "FK_472a74351fd6e1a88235aaf30ec"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7421efc125d95e413657efa3c6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bd2726fd31b35443f2245b93ba"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cee5459245f652b75eb2759b4c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c69efb19bf127c97e6740ad530"`);
        await queryRunner.query(`DROP TABLE "audit_logs"`);
        await queryRunner.query(`DROP TYPE "public"."audit_logs_userrole_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b8af4194277281dcfe08be4264"`);
        await queryRunner.query(`DROP TABLE "states"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_aab253fd80b0342d52ef2a06be"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d4842916487f15fcca89b1a918"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d89b2ee682c9475006762b666e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7f2dd4f380d2902d0562e2f886"`);
        await queryRunner.query(`DROP TABLE "submissions"`);
        await queryRunner.query(`DROP TYPE "public"."submissions_current_owner_role_enum"`);
        await queryRunner.query(`DROP TYPE "public"."submissions_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cb1a1bedcecd9a2032fa5f91c5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_98bbd4b61a123a3464e6a4b9e6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_996fcc8d018ec1fe50c42159d8"`);
        await queryRunner.query(`DROP TABLE "final_scores"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_472a74351fd6e1a88235aaf30e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4e50b495261d79866cad4e35cf"`);
        await queryRunner.query(`DROP TABLE "user_indicator_scope"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7908c77362d20f1c428d49bfe4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c953c376bf505e75316a1fc02e"`);
        await queryRunner.query(`DROP TABLE "indicators"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7427b2da8bae1e61c3c1e9ee10"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    }

}
