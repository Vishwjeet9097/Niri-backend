-- =====================================================
-- NIRI Backend - Complete Database Setup with Exact Column Names
-- =====================================================
-- यह script सभी tables को exact column names के साथ create करता है
-- जैसा कि database schema images में दिखाया गया है
-- Date: 2025-01-27
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. CREATE ENUM TYPES
-- =====================================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE "user_role" AS ENUM('NODAL_OFFICER', 'STATE_APPROVER', 'MOSPI_REVIEWER', 'MOSPI_APPROVER', 'ADMIN');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'submission_status') THEN
        CREATE TYPE "submission_status" AS ENUM('DRAFT', 'SUBMITTED_TO_STATE', 'SUBMITTED_TO_MOSPI_REVIEWER', 'SUBMITTED_TO_MOSPI_APPROVER', 'REJECTED', 'REJECTED_FINAL', 'RETURNED_FROM_STATE', 'RETURNED_FROM_MOSPI', 'APPROVED');
    END IF;
END $$;

-- =====================================================
-- 2. CREATE USERS TABLE (with exact column names)
-- =====================================================
CREATE TABLE IF NOT EXISTS "users" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "email" character varying(255) NOT NULL,
    "password" character varying(255) NOT NULL,
    "firstName" character varying(255) NOT NULL,
    "lastName" character varying(255) NOT NULL,
    "contactNumber" character varying(20),
    "role" user_role NOT NULL,
    "state_ut" character varying(100) NOT NULL,
    "isActive" boolean DEFAULT true,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "indicator_comment" jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "users_email_key" UNIQUE ("email")
);

CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users" ("email");
CREATE INDEX IF NOT EXISTS "idx_users_state_ut_role" ON "users" ("state_ut", "role");

-- =====================================================
-- 3. CREATE INDICATORS TABLE (with exact column names)
-- =====================================================
CREATE TABLE IF NOT EXISTS "indicators" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "code" character varying(50) NOT NULL,
    "section_id" character varying(50) NOT NULL,
    "indicator_name" character varying(255) NOT NULL,
    "category" character varying(255) NOT NULL,
    "max_score" numeric(10,2) NOT NULL,
    "is_active" boolean NOT NULL DEFAULT true,
    "created_at" timestamp without time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT "PK_indicators" PRIMARY KEY ("id"),
    CONSTRAINT "UQ_indicators_code" UNIQUE ("code")
);

CREATE INDEX IF NOT EXISTS "IDX_indicators_code" ON "indicators" ("code");
CREATE INDEX IF NOT EXISTS "IDX_indicators_section_id" ON "indicators" ("section_id");
CREATE INDEX IF NOT EXISTS "IDX_indicators_category" ON "indicators" ("category");

-- =====================================================
-- 4. CREATE STATES TABLE (with exact column names)
-- =====================================================
CREATE TABLE IF NOT EXISTS "states" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "name" character varying(255) NOT NULL,
    "state_code" character varying(10) NOT NULL,
    "is_active" boolean NOT NULL DEFAULT true,
    "created_at" timestamp without time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT "PK_states" PRIMARY KEY ("id"),
    CONSTRAINT "UQ_states_name" UNIQUE ("name"),
    CONSTRAINT "UQ_states_state_code" UNIQUE ("state_code")
);

CREATE INDEX IF NOT EXISTS "IDX_states_name" ON "states" ("name");
CREATE INDEX IF NOT EXISTS "IDX_states_state_code" ON "states" ("state_code");

-- =====================================================
-- 5. CREATE USER_INDICATOR_SCOPE TABLE (with exact column names)
-- =====================================================
CREATE TABLE IF NOT EXISTS "user_indicator_scope" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid NOT NULL,
    "indicator_id" uuid NOT NULL,
    "is_active" boolean NOT NULL DEFAULT true,
    "created_at" timestamp without time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp without time zone NOT NULL DEFAULT now(),
    "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
    "updatedAt" timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT "PK_user_indicator_scope" PRIMARY KEY ("id"),
    CONSTRAINT "UQ_user_indicator_scope_user_indicator" UNIQUE ("user_id", "indicator_id")
);

CREATE INDEX IF NOT EXISTS "IDX_user_indicator_scope_user_id" ON "user_indicator_scope" ("user_id");
CREATE INDEX IF NOT EXISTS "IDX_user_indicator_scope_indicator_id" ON "user_indicator_scope" ("indicator_id");
CREATE INDEX IF NOT EXISTS "IDX_user_indicator_scope_unique" ON "user_indicator_scope" ("user_id", "indicator_id");

-- Foreign keys for user_indicator_scope
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_user_indicator_scope_user_id') THEN
        ALTER TABLE "user_indicator_scope" 
            ADD CONSTRAINT "FK_user_indicator_scope_user_id" 
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_user_indicator_scope_indicator_id') THEN
        ALTER TABLE "user_indicator_scope" 
            ADD CONSTRAINT "FK_user_indicator_scope_indicator_id" 
            FOREIGN KEY ("indicator_id") REFERENCES "indicators"("id") ON DELETE CASCADE;
    END IF;
END $$;

-- =====================================================
-- 6. CREATE SUBMISSIONS TABLE (with exact column names)
-- =====================================================
CREATE TABLE IF NOT EXISTS "submissions" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "submission_id" character varying(255) NOT NULL,
    "stateUt" character varying(100) NOT NULL,
    "submitted_by" uuid NOT NULL,
    "rejection_count" integer DEFAULT 0,
    "form_data" jsonb NOT NULL,
    "review_comments" jsonb DEFAULT '[]'::jsonb,
    "attached_files" jsonb DEFAULT '{}'::jsonb,
    "status" submission_status DEFAULT 'SUBMITTED_TO_STATE'::submission_status,
    "current_owner_role" user_role DEFAULT 'STATE_APPROVER'::user_role,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "indicator_comment" jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "submissions_submission_id_key" ON "submissions" ("submission_id");

-- Foreign key for submissions
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'submissions_submitted_by_fkey') THEN
        ALTER TABLE "submissions" 
            ADD CONSTRAINT "submissions_submitted_by_fkey" 
            FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE CASCADE;
    END IF;
END $$;

-- =====================================================
-- 7. CREATE FINAL_SCORES TABLE (with exact column names)
-- =====================================================
CREATE TABLE IF NOT EXISTS "final_scores" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "submissionId" uuid NOT NULL,
    "stateUt" character varying(100) NOT NULL,
    "totalScore" numeric(10,2) NOT NULL,
    "scoreBreakdown" jsonb NOT NULL,
    "calculationMethodology" text NOT NULL,
    "approvedBy" character varying(255) NOT NULL,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "categoryScores" jsonb,
    "scoringVersion" jsonb,
    "percentage" jsonb,
    CONSTRAINT "final_scores_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "final_scores_submission_id_key" UNIQUE ("submissionId")
);

CREATE INDEX IF NOT EXISTS "idx_final_scores_state_ut" ON "final_scores" ("stateUt");
CREATE INDEX IF NOT EXISTS "idx_final_scores_total_score" ON "final_scores" ("totalScore");
CREATE INDEX IF NOT EXISTS "idx_final_scores_created_at" ON "final_scores" ("createdAt");

-- Foreign key for final_scores
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'final_scores_submission_id_fkey') THEN
        ALTER TABLE "final_scores" 
            ADD CONSTRAINT "final_scores_submission_id_fkey" 
            FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE;
    END IF;
END $$;

-- =====================================================
-- 8. CREATE AUDIT_LOGS TABLE (with exact column names)
-- =====================================================
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "entity_type" character varying(100) NOT NULL,
    "entity_id" character varying(255) NOT NULL,
    "user_id" character varying(255) NOT NULL,
    "userRole" user_role NOT NULL,
    "action" character varying(100) NOT NULL,
    "oldValues" jsonb,
    "newValues" jsonb,
    "ip_address" character varying(45),
    "user_agent" text,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_audit_logs_entity" ON "audit_logs" ("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_user_id" ON "audit_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_action" ON "audit_logs" ("action");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_created_at" ON "audit_logs" ("createdAt");

-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT 'Database created successfully with exact column names!' as status;
SELECT COUNT(*) as "Total Tables" FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('users', 'indicators', 'states', 'user_indicator_scope', 'submissions', 'final_scores', 'audit_logs');

