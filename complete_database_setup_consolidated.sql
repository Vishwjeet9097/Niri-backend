-- =====================================================
-- NIRI Backend - Complete Database Setup Script (Consolidated)
-- =====================================================
-- This consolidated script can be used to:
-- 1. Create a NEW database from scratch
-- 2. Update an EXISTING database to current state
-- 
-- The script is idempotent - safe to run multiple times
-- Includes: All tables, foreign keys, indexes, and indicator seed data
-- Date: 2025-01-XX
-- =====================================================

-- Enable UUID extension if not already enabled
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
-- 2. CREATE USERS TABLE
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
-- 3. CREATE INDICATORS TABLE
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
-- 4. CREATE STATES TABLE
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
-- 5. CREATE USER_INDICATOR_SCOPE TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS "user_indicator_scope" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid NOT NULL,
    "indicator_id" uuid NOT NULL,
    "is_active" boolean NOT NULL DEFAULT true,
    "createdAt" timestamp without time zone NOT NULL DEFAULT now(),
    "updatedAt" timestamp without time zone NOT NULL DEFAULT now(),
    CONSTRAINT "PK_user_indicator_scope" PRIMARY KEY ("id"),
    CONSTRAINT "UQ_user_indicator_scope_user_indicator" UNIQUE ("user_id", "indicator_id")
);

CREATE INDEX IF NOT EXISTS "IDX_user_indicator_scope_user_id" ON "user_indicator_scope" ("user_id");
CREATE INDEX IF NOT EXISTS "IDX_user_indicator_scope_indicator_id" ON "user_indicator_scope" ("indicator_id");

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
-- 6. CREATE SUBMISSIONS TABLE
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

-- Add indicator_comment column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'submissions' 
        AND column_name = 'indicator_comment'
    ) THEN
        ALTER TABLE "submissions" 
        ADD COLUMN "indicator_comment" jsonb DEFAULT '{}'::jsonb;
    END IF;
END $$;

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
-- 7. CREATE FINAL_SCORES TABLE
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
-- 8. CREATE AUDIT_LOGS TABLE
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
-- 9. CREATE INDICATOR_SCORES TABLE (Per-Indicator Scoring)
-- =====================================================
CREATE TABLE IF NOT EXISTS "indicator_scores" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "submissionId" uuid NOT NULL,
    "indicatorCode" character varying(50) NOT NULL,
    "category" character varying(100) NOT NULL,
    "score" decimal(10,2) NOT NULL,
    "maxScore" decimal(10,2) NOT NULL,
    "calculation" jsonb NOT NULL,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "indicator_scores_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "indicator_scores_submission_indicator_unique" UNIQUE ("submissionId", "indicatorCode")
);

-- =====================================================
-- 10. CREATE INDICATOR_SCORE_HISTORY TABLE (Score History Tracking)
-- =====================================================
CREATE TABLE IF NOT EXISTS "indicator_score_history" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "submissionId" uuid NOT NULL,
    "indicatorCode" character varying(50) NOT NULL,
    "category" character varying(100) NOT NULL,
    "score" decimal(10,2) NOT NULL,
    "maxScore" decimal(10,2) NOT NULL,
    "previousScore" decimal(10,2),
    "scoreChange" decimal(10,2),
    "calculation" jsonb NOT NULL,
    "formDataSnapshot" jsonb,
    "updatedBy" character varying(255),
    "updateReason" character varying(100),
    "indicatorStatus" character varying(100),
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "indicator_score_history_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- 11. FIX COLUMN TYPES FOR EXISTING DATABASES
-- =====================================================
-- This section handles existing databases that may have VARCHAR instead of UUID
-- It's safe to run even if columns are already UUID type

-- Function to check if a string is a valid UUID
CREATE OR REPLACE FUNCTION is_uuid(uuid_string TEXT) RETURNS BOOLEAN AS $$
BEGIN
    PERFORM uuid_string::uuid;
    RETURN TRUE;
EXCEPTION WHEN invalid_text_representation THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fix indicator_scores.submissionId column type
DO $$
BEGIN
    -- Check if column exists and is not already UUID
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'indicator_scores' 
        AND column_name = 'submissionId'
        AND data_type != 'uuid'
    ) THEN
        -- Delete rows with invalid UUIDs
        DELETE FROM "indicator_scores" 
        WHERE "submissionId" IS NOT NULL 
        AND NOT is_uuid("submissionId"::text);
        
        -- Alter column type to UUID
        ALTER TABLE "indicator_scores" 
            ALTER COLUMN "submissionId" TYPE uuid USING "submissionId"::uuid;
        
        RAISE NOTICE 'Changed indicator_scores.submissionId from VARCHAR to UUID';
    ELSE
        RAISE NOTICE 'indicator_scores.submissionId is already UUID or table does not exist';
    END IF;
END $$;

-- Fix indicator_score_history.submissionId column type
DO $$
BEGIN
    -- Check if column exists and is not already UUID
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'indicator_score_history' 
        AND column_name = 'submissionId'
        AND data_type != 'uuid'
    ) THEN
        -- Delete rows with invalid UUIDs
        DELETE FROM "indicator_score_history" 
        WHERE "submissionId" IS NOT NULL 
        AND NOT is_uuid("submissionId"::text);
        
        -- Alter column type to UUID
        ALTER TABLE "indicator_score_history" 
            ALTER COLUMN "submissionId" TYPE uuid USING "submissionId"::uuid;
        
        RAISE NOTICE 'Changed indicator_score_history.submissionId from VARCHAR to UUID';
    ELSE
        RAISE NOTICE 'indicator_score_history.submissionId is already UUID or table does not exist';
    END IF;
END $$;

-- =====================================================
-- 12. ADD FOREIGN KEY CONSTRAINTS FOR INDICATOR SCORES
-- =====================================================

-- Add foreign key for indicator_scores
DO $$ 
BEGIN
    -- Check if column type is UUID before adding constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'indicator_scores' 
        AND column_name = 'submissionId'
        AND data_type = 'uuid'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'indicator_scores_submission_id_fkey'
        ) THEN
            ALTER TABLE "indicator_scores" 
                ADD CONSTRAINT "indicator_scores_submission_id_fkey" 
                FOREIGN KEY ("submissionId") 
                REFERENCES "submissions"("id") 
                ON DELETE CASCADE;
            
            RAISE NOTICE 'Foreign key constraint added: indicator_scores_submission_id_fkey';
        ELSE
            RAISE NOTICE 'Foreign key constraint already exists: indicator_scores_submission_id_fkey';
        END IF;
    ELSE
        RAISE NOTICE 'Skipping foreign key for indicator_scores - submissionId is not UUID type';
    END IF;
END $$;

-- Add foreign key for indicator_score_history
DO $$ 
BEGIN
    -- Check if column type is UUID before adding constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'indicator_score_history' 
        AND column_name = 'submissionId'
        AND data_type = 'uuid'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'indicator_score_history_submission_id_fkey'
        ) THEN
            ALTER TABLE "indicator_score_history" 
                ADD CONSTRAINT "indicator_score_history_submission_id_fkey" 
                FOREIGN KEY ("submissionId") 
                REFERENCES "submissions"("id") 
                ON DELETE CASCADE;
            
            RAISE NOTICE 'Foreign key constraint added: indicator_score_history_submission_id_fkey';
        ELSE
            RAISE NOTICE 'Foreign key constraint already exists: indicator_score_history_submission_id_fkey';
        END IF;
    ELSE
        RAISE NOTICE 'Skipping foreign key for indicator_score_history - submissionId is not UUID type';
    END IF;
END $$;

-- =====================================================
-- 13. CREATE INDEXES FOR INDICATOR SCORES
-- =====================================================

-- Indicator Scores indexes
CREATE INDEX IF NOT EXISTS "idx_indicator_scores_submission_indicator" 
    ON "indicator_scores" ("submissionId", "indicatorCode");
CREATE INDEX IF NOT EXISTS "idx_indicator_scores_submission" 
    ON "indicator_scores" ("submissionId");
CREATE INDEX IF NOT EXISTS "idx_indicator_scores_indicator" 
    ON "indicator_scores" ("indicatorCode");
CREATE INDEX IF NOT EXISTS "idx_indicator_scores_category" 
    ON "indicator_scores" ("category");

-- Indicator Score History indexes
CREATE INDEX IF NOT EXISTS "idx_indicator_score_history_submission_indicator" 
    ON "indicator_score_history" ("submissionId", "indicatorCode");
CREATE INDEX IF NOT EXISTS "idx_indicator_score_history_submission" 
    ON "indicator_score_history" ("submissionId");
CREATE INDEX IF NOT EXISTS "idx_indicator_score_history_indicator" 
    ON "indicator_score_history" ("indicatorCode");
CREATE INDEX IF NOT EXISTS "idx_indicator_score_history_created_at" 
    ON "indicator_score_history" ("createdAt");
CREATE INDEX IF NOT EXISTS "idx_indicator_score_history_category" 
    ON "indicator_score_history" ("category");

-- =====================================================
-- 14. INSERT/UPDATE INDICATORS (Based on Current Implementation)
-- =====================================================
-- This section ensures the indicators table has the correct 19 indicators
-- matching the current code implementation
-- Safe to run on both new and existing databases

-- Insert/Update indicators using UPSERT (ON CONFLICT DO UPDATE)
INSERT INTO "indicators" (
    "code",
    "section_id",
    "indicator_name",
    "category",
    "max_score",
    "is_active",
    "created_at",
    "updated_at"
) VALUES 
-- Section 1: Infrastructure Financing (5 indicators)
('1.1', '1', '% of Capex to GSDP', 'Infrastructure Financing', 50.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('1.2', '1', '% Capex Utilization', 'Infrastructure Financing', 50.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('1.3', '1', '% of Credit Rated ULBs', 'Infrastructure Financing', 50.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('1.4', '1', '% of ULBs Issuing Bonds', 'Infrastructure Financing', 50.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('1.5', '1', 'Functional Financial Intermediary', 'Infrastructure Financing', 50.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Section 2: Infrastructure Development (5 indicators)
('2.1', '2', 'Availability of Infrastructure Act/Policy', 'Infrastructure Development', 50.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('2.2', '2', 'Availability of Specialized Entity', 'Infrastructure Development', 50.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('2.3', '2', 'Sector Infra Development Plan', 'Infrastructure Development', 50.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('2.4', '2', 'Investment Ready Project Pipeline', 'Infrastructure Development', 50.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('2.5', '2', 'Asset Monetization Pipeline', 'Infrastructure Development', 50.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Section 3: PPP Development (4 indicators)
('3.1', '3', 'Availability of PPP Act/Policy', 'PPP Development', 50.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('3.2', '3', 'Functional PPP Cell/Unit', 'PPP Development', 50.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('3.3', '3', 'Proposals under VGF/IIPDF', 'PPP Development', 50.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('3.4', '3', 'Proportion of TPC of PPP Projects', 'PPP Development', 100.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Section 4: Infrastructure Enablers (5 indicators - matching current implementation)
('4.1', '4', 'Availability and use of State/UT PMG portal', 'Infrastructure Enablers', 70.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('4.2', '4', 'Adoption of PM GatiShakti NMP', 'Infrastructure Enablers', 30.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('4.3', '4', 'Adoption of ADR', 'Infrastructure Enablers', 50.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('4.4', '4', 'Innovative Practices', 'Infrastructure Enablers', 50.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('4.5', '4', 'Capacity Building - Officer Participation', 'Infrastructure Enablers', 50.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)

ON CONFLICT ("code") 
DO UPDATE SET
    "indicator_name" = EXCLUDED."indicator_name",
    "category" = EXCLUDED."category",
    "max_score" = EXCLUDED."max_score",
    "is_active" = EXCLUDED."is_active",
    "updated_at" = CURRENT_TIMESTAMP;

-- =====================================================
-- 15. VERIFICATION
-- =====================================================
SELECT 'Database setup completed successfully!' as status;

-- Count all tables
SELECT 
    COUNT(*) as "Total Tables",
    string_agg(table_name, ', ' ORDER BY table_name) as "Table Names"
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'users', 
    'indicators', 
    'states', 
    'user_indicator_scope', 
    'submissions', 
    'final_scores', 
    'audit_logs',
    'indicator_scores',
    'indicator_score_history'
);

-- Verify indicator score tables
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name IN ('indicator_scores', 'indicator_score_history')
AND column_name = 'submissionId'
ORDER BY table_name, column_name;

-- Verify foreign keys
SELECT 
    conname as constraint_name,
    conrelid::regclass as table_name,
    confrelid::regclass as referenced_table,
    CASE 
        WHEN confdeltype = 'c' THEN 'CASCADE'
        WHEN confdeltype = 'r' THEN 'RESTRICT'
        WHEN confdeltype = 'a' THEN 'NO ACTION'
        WHEN confdeltype = 'n' THEN 'SET NULL'
        WHEN confdeltype = 'd' THEN 'SET DEFAULT'
    END as delete_action
FROM pg_constraint
WHERE conname IN (
    'indicator_scores_submission_id_fkey',
    'indicator_score_history_submission_id_fkey',
    'submissions_submitted_by_fkey',
    'final_scores_submission_id_fkey',
    'FK_user_indicator_scope_user_id',
    'FK_user_indicator_scope_indicator_id'
)
ORDER BY conname;

-- Verify indicators count
SELECT 
    'Indicators Verification:' as status,
    COUNT(*) as total_indicators,
    COUNT(CASE WHEN "section_id" = '1' THEN 1 END) as infra_financing_count,
    COUNT(CASE WHEN "section_id" = '2' THEN 1 END) as infra_development_count,
    COUNT(CASE WHEN "section_id" = '3' THEN 1 END) as ppp_development_count,
    COUNT(CASE WHEN "section_id" = '4' THEN 1 END) as infra_enablers_count
FROM "indicators"
WHERE "is_active" = true;

-- Show all active indicators
SELECT 
    "code",
    "section_id",
    "indicator_name",
    "category",
    "max_score"
FROM "indicators"
WHERE "is_active" = true
ORDER BY "section_id", "code";

-- =====================================================
-- END OF SCRIPT
-- =====================================================

