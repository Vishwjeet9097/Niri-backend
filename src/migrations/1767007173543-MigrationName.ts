import { MigrationInterface, QueryRunner } from "typeorm";

export class MigrationName1767007173543 implements MigrationInterface {
    name = 'MigrationName1767007173543'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check and create tables only if they don't exist
        const ministryFormExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'ministry_form'
            )
        `);
        if (!ministryFormExists[0].exists) {
            await queryRunner.query(`CREATE TABLE "ministry_form" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "year" integer, "ministry" character varying(255), "reviewer" character varying(255), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b39f2b85f6bcb98bbcbb121d5ec" PRIMARY KEY ("id"))`);
        }

        const categoryEnumExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM pg_type WHERE typname = 'ministry_indicator_details_category_enum'
            )
        `);
        if (!categoryEnumExists[0].exists) {
            await queryRunner.query(`CREATE TYPE "public"."ministry_indicator_details_category_enum" AS ENUM('Infra Financing', 'Infra Enablers', 'Infra Development', 'PPP Development')`);
        }

        const ministryIndicatorDetailsExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'ministry_indicator_details'
            )
        `);
        if (!ministryIndicatorDetailsExists[0].exists) {
            await queryRunner.query(`CREATE TABLE "ministry_indicator_details" ("id" character varying(255) NOT NULL, "s_no" character varying(50) NOT NULL, "name" character varying NOT NULL, "category" "public"."ministry_indicator_details_category_enum" NOT NULL, "sequence" integer NOT NULL DEFAULT '0', "status" boolean NOT NULL DEFAULT true, "associated_form" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_64ce3e23af49b4caf4a59affbde" PRIMARY KEY ("id"))`);
            await queryRunner.query(`CREATE UNIQUE INDEX "IDX_b24240fa29691332c765dd7ad7" ON "ministry_indicator_details" ("s_no") `);
        }

        const ministryIndicatorSubsectionsExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'ministry_indicator_subsections'
            )
        `);
        if (!ministryIndicatorSubsectionsExists[0].exists) {
            await queryRunner.query(`CREATE TABLE "ministry_indicator_subsections" ("id" character varying(500) NOT NULL, "name" character varying NOT NULL, "indicator_id" character varying NOT NULL, "sequence" integer NOT NULL DEFAULT '0', "status" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c2bfe3e74023375c8c53566276f" PRIMARY KEY ("id"))`);
            await queryRunner.query(`CREATE INDEX "IDX_ec0761cc1e8bfb448b1f5749fb" ON "ministry_indicator_subsections" ("indicator_id", "sequence") `);
        }

        const dataTypeEnumExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM pg_type WHERE typname = 'ministry_input_fields_data_type_enum'
            )
        `);
        if (!dataTypeEnumExists[0].exists) {
            await queryRunner.query(`CREATE TYPE "public"."ministry_input_fields_data_type_enum" AS ENUM('number', 'file', 'string')`);
        }

        const ministryInputFieldsExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'ministry_input_fields'
            )
        `);
        if (!ministryInputFieldsExists[0].exists) {
            await queryRunner.query(`CREATE TABLE "ministry_input_fields" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "section_id" character varying NOT NULL, "label" character varying NOT NULL, "data_type" "public"."ministry_input_fields_data_type_enum" NOT NULL DEFAULT 'string', "validation_rules" jsonb, "sequence" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9651ac6a39a1ee4ce0597cb1871" PRIMARY KEY ("id"))`);
            await queryRunner.query(`CREATE INDEX "IDX_11780a3844396a311a8901ac73" ON "ministry_input_fields" ("section_id", "sequence") `);
        }

        const submissionStatusEnumExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM pg_type WHERE typname = 'ministry_submission_status_enum'
            )
        `);
        if (!submissionStatusEnumExists[0].exists) {
            await queryRunner.query(`CREATE TYPE "public"."ministry_submission_status_enum" AS ENUM('DRAFT', 'SUBMITTED_TO_STATE', 'SUBMITTED_TO_MOSPI_REVIEWER', 'SUBMITTED_TO_MOSPI_APPROVER', 'REJECTED', 'REJECTED_FINAL', 'RETURNED_FROM_STATE', 'RETURNED_FROM_MOSPI', 'APPROVED')`);
        }

        const ministrySubmissionExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'ministry_submission'
            )
        `);
        if (!ministrySubmissionExists[0].exists) {
            await queryRunner.query(`CREATE TABLE "ministry_submission" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "submission_id" character varying NOT NULL, "form_id" character varying NOT NULL, "user_id" character varying NOT NULL, "status" "public"."ministry_submission_status_enum" NOT NULL DEFAULT 'DRAFT', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_362baf09bdb8ed09692bcf53e35" UNIQUE ("submission_id"), CONSTRAINT "PK_6871d2a135d509c99a90c7263e7" PRIMARY KEY ("id"))`);
            await queryRunner.query(`CREATE INDEX "IDX_79b22cf00d58bd904ccc9c26e0" ON "ministry_submission" ("status") `);
            await queryRunner.query(`CREATE INDEX "IDX_5493a6d101dc3dac38bce42f8b" ON "ministry_submission" ("user_id") `);
            await queryRunner.query(`CREATE INDEX "IDX_38fc94220303a76b4d222a83b7" ON "ministry_submission" ("form_id") `);
            await queryRunner.query(`CREATE UNIQUE INDEX "IDX_362baf09bdb8ed09692bcf53e3" ON "ministry_submission" ("submission_id") `);
        }

        const ministrySubmissionIndicatorExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'ministry_submission_indicator'
            )
        `);
        if (!ministrySubmissionIndicatorExists[0].exists) {
            await queryRunner.query(`CREATE TABLE "ministry_submission_indicator" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "submission_id" character varying NOT NULL, "indicator_id" character varying NOT NULL, "status" boolean NOT NULL DEFAULT true, "assigned_to" character varying(255), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_61710153c626781a12502541d03" PRIMARY KEY ("id"))`);
            await queryRunner.query(`CREATE UNIQUE INDEX "IDX_62b3dfcbd06b2c6bbe510db013" ON "ministry_submission_indicator" ("submission_id", "indicator_id") `);
        }
        // Update submissions table - check if column exists and if enum needs updating
        const submissionsTableExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'submissions'
            )
        `);
        if (submissionsTableExists[0].exists) {
            // Update attached_files default if needed
            await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "attached_files" SET DEFAULT '[]'::jsonb`);
            
            // Check if enum needs updating
            const ownerRoleEnumExists = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT FROM pg_type WHERE typname = 'submissions_current_owner_role_enum'
                )
            `);
            
            if (ownerRoleEnumExists[0].exists) {
                const ownerRoleEnumHasMinistry = await queryRunner.query(`
                    SELECT EXISTS (
                        SELECT 1 FROM pg_enum 
                        WHERE enumlabel = 'MINISTRY_APPROVER' 
                        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'submissions_current_owner_role_enum')
                    )
                `);
                
                if (!ownerRoleEnumHasMinistry[0].exists) {
                await queryRunner.query(`ALTER TYPE "public"."submissions_current_owner_role_enum" RENAME TO "submissions_current_owner_role_enum_old"`);
                await queryRunner.query(`CREATE TYPE "public"."submissions_current_owner_role_enum" AS ENUM('NODAL_OFFICER', 'STATE_APPROVER', 'MOSPI_REVIEWER', 'MOSPI_APPROVER', 'ADMIN', 'MINISTRY_APPROVER')`);
                await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "current_owner_role" DROP DEFAULT`);
                await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "current_owner_role" TYPE "public"."submissions_current_owner_role_enum" USING "current_owner_role"::"text"::"public"."submissions_current_owner_role_enum"`);
                    await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "current_owner_role" SET DEFAULT 'STATE_APPROVER'`);
                    await queryRunner.query(`DROP TYPE "public"."submissions_current_owner_role_enum_old"`);
                }
            }
        }

        // Update audit_logs table - check if enum needs updating
        const auditLogsTableExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'audit_logs'
            )
        `);
        if (auditLogsTableExists[0].exists) {
            const auditLogsEnumExists = await queryRunner.query(`
                SELECT EXISTS (
                    SELECT FROM pg_type WHERE typname = 'audit_logs_userrole_enum'
                )
            `);
            
            if (auditLogsEnumExists[0].exists) {
                const auditLogsEnumHasMinistry = await queryRunner.query(`
                    SELECT EXISTS (
                        SELECT 1 FROM pg_enum 
                        WHERE enumlabel = 'MINISTRY_APPROVER' 
                        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'audit_logs_userrole_enum')
                    )
                `);
                
                if (!auditLogsEnumHasMinistry[0].exists) {
                await queryRunner.query(`ALTER TYPE "public"."audit_logs_userrole_enum" RENAME TO "audit_logs_userrole_enum_old"`);
                await queryRunner.query(`CREATE TYPE "public"."audit_logs_userrole_enum" AS ENUM('NODAL_OFFICER', 'STATE_APPROVER', 'MOSPI_REVIEWER', 'MOSPI_APPROVER', 'ADMIN', 'MINISTRY_APPROVER')`);
                    await queryRunner.query(`ALTER TABLE "audit_logs" ALTER COLUMN "userRole" TYPE "public"."audit_logs_userrole_enum" USING "userRole"::"text"::"public"."audit_logs_userrole_enum"`);
                    await queryRunner.query(`DROP TYPE "public"."audit_logs_userrole_enum_old"`);
                }
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."audit_logs_userrole_enum_old" AS ENUM('NODAL_OFFICER', 'STATE_APPROVER', 'MOSPI_REVIEWER', 'MOSPI_APPROVER', 'ADMIN')`);
        await queryRunner.query(`ALTER TABLE "audit_logs" ALTER COLUMN "userRole" TYPE "public"."audit_logs_userrole_enum_old" USING "userRole"::"text"::"public"."audit_logs_userrole_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."audit_logs_userrole_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."audit_logs_userrole_enum_old" RENAME TO "audit_logs_userrole_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."submissions_current_owner_role_enum_old" AS ENUM('NODAL_OFFICER', 'STATE_APPROVER', 'MOSPI_REVIEWER', 'MOSPI_APPROVER', 'ADMIN')`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "current_owner_role" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "current_owner_role" TYPE "public"."submissions_current_owner_role_enum_old" USING "current_owner_role"::"text"::"public"."submissions_current_owner_role_enum_old"`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "current_owner_role" SET DEFAULT 'STATE_APPROVER'`);
        await queryRunner.query(`DROP TYPE "public"."submissions_current_owner_role_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."submissions_current_owner_role_enum_old" RENAME TO "submissions_current_owner_role_enum"`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "attached_files" SET DEFAULT '[]'`);
        await queryRunner.query(`DROP INDEX "public"."IDX_62b3dfcbd06b2c6bbe510db013"`);
        await queryRunner.query(`DROP TABLE "ministry_submission_indicator"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_362baf09bdb8ed09692bcf53e3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_38fc94220303a76b4d222a83b7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5493a6d101dc3dac38bce42f8b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_79b22cf00d58bd904ccc9c26e0"`);
        await queryRunner.query(`DROP TABLE "ministry_submission"`);
        await queryRunner.query(`DROP TYPE "public"."ministry_submission_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_11780a3844396a311a8901ac73"`);
        await queryRunner.query(`DROP TABLE "ministry_input_fields"`);
        await queryRunner.query(`DROP TYPE "public"."ministry_input_fields_data_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ec0761cc1e8bfb448b1f5749fb"`);
        await queryRunner.query(`DROP TABLE "ministry_indicator_subsections"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b24240fa29691332c765dd7ad7"`);
        await queryRunner.query(`DROP TABLE "ministry_indicator_details"`);
        await queryRunner.query(`DROP TYPE "public"."ministry_indicator_details_category_enum"`);
        await queryRunner.query(`DROP TABLE "ministry_form"`);
    }

}
