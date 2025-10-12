"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddRejectedStatus1760250527699 = void 0;
class AddRejectedStatus1760250527699 {
    constructor() {
        this.name = 'AddRejectedStatus1760250527699';
    }
    async up(queryRunner) {
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('NODAL_OFFICER', 'STATE_APPROVER', 'MOSPI_REVIEWER', 'MOSPI_APPROVER')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "password" character varying NOT NULL, "firstName" character varying NOT NULL, "lastName" character varying NOT NULL, "role" "public"."users_role_enum" NOT NULL, "state_ut" character varying NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7427b2da8bae1e61c3c1e9ee10" ON "users" ("state_ut", "role") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
        await queryRunner.query(`CREATE TYPE "public"."submissions_status_enum" AS ENUM('DRAFT', 'SUBMITTED_TO_STATE', 'SUBMITTED_TO_MOSPI_REVIEWER', 'SUBMITTED_TO_MOSPI_APPROVER', 'REJECTED', 'REJECTED_FINAL', 'APPROVED')`);
        await queryRunner.query(`CREATE TYPE "public"."submissions_current_owner_role_enum" AS ENUM('NODAL_OFFICER', 'STATE_APPROVER', 'MOSPI_REVIEWER', 'MOSPI_APPROVER')`);
        await queryRunner.query(`CREATE TABLE "submissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "submission_id" character varying NOT NULL, "state_ut" character varying NOT NULL, "submitted_by" uuid NOT NULL, "rejection_count" integer NOT NULL DEFAULT '0', "form_data" jsonb NOT NULL, "review_comments" jsonb NOT NULL DEFAULT '[]', "attached_files" jsonb array NOT NULL DEFAULT '{}', "status" "public"."submissions_status_enum" NOT NULL DEFAULT 'SUBMITTED_TO_STATE', "current_owner_role" "public"."submissions_current_owner_role_enum" NOT NULL DEFAULT 'STATE_APPROVER', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_9d2b514f747142635edb10c1d3d" UNIQUE ("submission_id"), CONSTRAINT "PK_10b3be95b8b2fb1e482e07d706b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7f2dd4f380d2902d0562e2f886" ON "submissions" ("current_owner_role") `);
        await queryRunner.query(`CREATE INDEX "IDX_d89b2ee682c9475006762b666e" ON "submissions" ("submitted_by") `);
        await queryRunner.query(`CREATE INDEX "IDX_d4842916487f15fcca89b1a918" ON "submissions" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_d04393e1f9bd8d7261f4c0a16f" ON "submissions" ("state_ut") `);
        await queryRunner.query(`CREATE TABLE "final_scores" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "submission_id" uuid NOT NULL, "state_ut" character varying NOT NULL, "total_score" numeric(10,2) NOT NULL, "score_breakdown" jsonb NOT NULL, "calculation_methodology" text NOT NULL, "approved_by" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "REL_ca086d60022bb24faa3d5b0e41" UNIQUE ("submission_id"), CONSTRAINT "PK_526010129df3c6668c0558cc8b2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_996fcc8d018ec1fe50c42159d8" ON "final_scores" ("createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_c6e0b588d766a97538e93db0a3" ON "final_scores" ("total_score") `);
        await queryRunner.query(`CREATE INDEX "IDX_c9e6e8399de7e65f2bbd7cd536" ON "final_scores" ("state_ut") `);
        await queryRunner.query(`CREATE TYPE "public"."audit_logs_userrole_enum" AS ENUM('NODAL_OFFICER', 'STATE_APPROVER', 'MOSPI_REVIEWER', 'MOSPI_APPROVER')`);
        await queryRunner.query(`CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "entity_type" character varying NOT NULL, "entity_id" character varying NOT NULL, "user_id" character varying NOT NULL, "userRole" "public"."audit_logs_userrole_enum" NOT NULL, "action" character varying NOT NULL, "oldValues" jsonb, "newValues" jsonb, "ip_address" character varying, "user_agent" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c69efb19bf127c97e6740ad530" ON "audit_logs" ("createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_cee5459245f652b75eb2759b4c" ON "audit_logs" ("action") `);
        await queryRunner.query(`CREATE INDEX "IDX_bd2726fd31b35443f2245b93ba" ON "audit_logs" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_7421efc125d95e413657efa3c6" ON "audit_logs" ("entity_type", "entity_id") `);
        await queryRunner.query(`ALTER TABLE "submissions" ADD CONSTRAINT "FK_d89b2ee682c9475006762b666ef" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "final_scores" ADD CONSTRAINT "FK_ca086d60022bb24faa3d5b0e413" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "final_scores" DROP CONSTRAINT "FK_ca086d60022bb24faa3d5b0e413"`);
        await queryRunner.query(`ALTER TABLE "submissions" DROP CONSTRAINT "FK_d89b2ee682c9475006762b666ef"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7421efc125d95e413657efa3c6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bd2726fd31b35443f2245b93ba"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cee5459245f652b75eb2759b4c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c69efb19bf127c97e6740ad530"`);
        await queryRunner.query(`DROP TABLE "audit_logs"`);
        await queryRunner.query(`DROP TYPE "public"."audit_logs_userrole_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c9e6e8399de7e65f2bbd7cd536"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c6e0b588d766a97538e93db0a3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_996fcc8d018ec1fe50c42159d8"`);
        await queryRunner.query(`DROP TABLE "final_scores"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d04393e1f9bd8d7261f4c0a16f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d4842916487f15fcca89b1a918"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d89b2ee682c9475006762b666e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7f2dd4f380d2902d0562e2f886"`);
        await queryRunner.query(`DROP TABLE "submissions"`);
        await queryRunner.query(`DROP TYPE "public"."submissions_current_owner_role_enum"`);
        await queryRunner.query(`DROP TYPE "public"."submissions_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7427b2da8bae1e61c3c1e9ee10"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    }
}
exports.AddRejectedStatus1760250527699 = AddRejectedStatus1760250527699;
//# sourceMappingURL=1760250527699-AddRejectedStatus.js.map