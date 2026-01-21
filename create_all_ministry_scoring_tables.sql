-- =====================================================
-- NIRI Backend - Complete Ministry Scoring Tables Migration
-- =====================================================
-- This SINGLE script creates ALL 4 ministry scoring tables:
-- 1. ministry_indicator_scores - Per-indicator scores
-- 2. ministry_indicator_score_history - Score change history
-- 3. ministry_final_scores - Aggregated final scores
-- 4. ministry_manual_score_updates - Manual score overrides
-- 
-- This script is idempotent - safe to run multiple times
-- No errors if tables already exist
-- Date: 2025-01-XX
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. CREATE MINISTRY_INDICATOR_SCORES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS "ministry_indicator_scores" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "submissionId" uuid NOT NULL,
    "indicatorCode" character varying(50) NOT NULL,
    "category" character varying(100) NOT NULL,
    "score" decimal(10,2) NOT NULL,
    "maxScore" decimal(10,2) NOT NULL,
    "calculation" jsonb NOT NULL,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ministry_indicator_scores_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ministry_indicator_scores_submission_indicator_unique" UNIQUE ("submissionId", "indicatorCode")
);

-- Add indexes for better query performance (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS "idx_ministry_indicator_scores_submissionId" ON "ministry_indicator_scores" ("submissionId");
CREATE INDEX IF NOT EXISTS "idx_ministry_indicator_scores_indicatorCode" ON "ministry_indicator_scores" ("indicatorCode");
CREATE INDEX IF NOT EXISTS "idx_ministry_indicator_scores_category" ON "ministry_indicator_scores" ("category");

-- =====================================================
-- 2. CREATE MINISTRY_INDICATOR_SCORE_HISTORY TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS "ministry_indicator_score_history" (
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
    CONSTRAINT "ministry_indicator_score_history_pkey" PRIMARY KEY ("id")
);

-- Add indexes for better query performance (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS "idx_ministry_indicator_score_history_submissionId" ON "ministry_indicator_score_history" ("submissionId");
CREATE INDEX IF NOT EXISTS "idx_ministry_indicator_score_history_indicatorCode" ON "ministry_indicator_score_history" ("indicatorCode");
CREATE INDEX IF NOT EXISTS "idx_ministry_indicator_score_history_createdAt" ON "ministry_indicator_score_history" ("createdAt");
CREATE INDEX IF NOT EXISTS "idx_ministry_indicator_score_history_submission_indicator" ON "ministry_indicator_score_history" ("submissionId", "indicatorCode");

-- =====================================================
-- 3. CREATE MINISTRY_FINAL_SCORES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS "ministry_final_scores" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "submissionId" uuid NOT NULL,
    "ministryId" character varying(100) NOT NULL,
    "totalScore" decimal(10,2) NOT NULL,
    "percentage" decimal(5,2),
    "scoreBreakdown" jsonb NOT NULL,
    "calculationMethodology" text NOT NULL,
    "approvedBy" character varying(255) NOT NULL,
    "categoryScores" jsonb,
    "scoringVersion" character varying(50) DEFAULT '1.0',
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ministry_final_scores_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ministry_final_scores_submission_id_key" UNIQUE ("submissionId")
);

-- Add indexes for better query performance (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS "idx_ministry_final_scores_ministryId" ON "ministry_final_scores" ("ministryId");
CREATE INDEX IF NOT EXISTS "idx_ministry_final_scores_totalScore" ON "ministry_final_scores" ("totalScore");
CREATE INDEX IF NOT EXISTS "idx_ministry_final_scores_createdAt" ON "ministry_final_scores" ("createdAt");

-- =====================================================
-- 4. CREATE MINISTRY_MANUAL_SCORE_UPDATES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS "ministry_manual_score_updates" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "submissionId" uuid NOT NULL,
    "indicatorCode" character varying(50) NOT NULL,
    "category" character varying(100) NOT NULL,
    "systemScore" decimal(10,2) NOT NULL,
    "manualUpdatedScore" decimal(10,2) NOT NULL,
    "maxScore" decimal(10,2) NOT NULL,
    "updateReason" text NOT NULL,
    "updatedBy" uuid NOT NULL,
    "createdAt" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ministry_manual_score_updates_pkey" PRIMARY KEY ("id")
);

-- Create indexes for better query performance (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS "idx_ministry_manual_score_updates_submission_indicator" 
    ON "ministry_manual_score_updates" ("submissionId", "indicatorCode");
    
CREATE INDEX IF NOT EXISTS "idx_ministry_manual_score_updates_submission" 
    ON "ministry_manual_score_updates" ("submissionId");
    
CREATE INDEX IF NOT EXISTS "idx_ministry_manual_score_updates_indicator" 
    ON "ministry_manual_score_updates" ("indicatorCode");
    
CREATE INDEX IF NOT EXISTS "idx_ministry_manual_score_updates_created" 
    ON "ministry_manual_score_updates" ("createdAt");

-- =====================================================
-- 5. CREATE FUNCTIONS FOR TRIGGERS
-- =====================================================
-- Function for ministry_indicator_scores updatedAt trigger
CREATE OR REPLACE FUNCTION update_ministry_indicator_scores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function for ministry_final_scores updatedAt trigger
CREATE OR REPLACE FUNCTION update_ministry_final_scores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. CREATE TRIGGERS (with existence check)
-- =====================================================
-- Trigger for ministry_indicator_scores
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trigger_update_ministry_indicator_scores_updated_at'
    ) THEN
        CREATE TRIGGER trigger_update_ministry_indicator_scores_updated_at
            BEFORE UPDATE ON "ministry_indicator_scores"
            FOR EACH ROW
            EXECUTE FUNCTION update_ministry_indicator_scores_updated_at();
    END IF;
END $$;

-- Trigger for ministry_final_scores
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trigger_update_ministry_final_scores_updated_at'
    ) THEN
        CREATE TRIGGER trigger_update_ministry_final_scores_updated_at
            BEFORE UPDATE ON "ministry_final_scores"
            FOR EACH ROW
            EXECUTE FUNCTION update_ministry_final_scores_updated_at();
    END IF;
END $$;

-- =====================================================
-- 7. ADD FOREIGN KEY CONSTRAINTS (Optional - commented out)
-- =====================================================
-- Uncomment these if you want to enforce referential integrity
-- Note: These will fail if tables don't exist or if constraints already exist

/*
-- Foreign key for ministry_indicator_scores
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_ministry_indicator_scores_submission'
    ) THEN
        ALTER TABLE "ministry_indicator_scores" 
            ADD CONSTRAINT "fk_ministry_indicator_scores_submission" 
            FOREIGN KEY ("submissionId") 
            REFERENCES "ministry_submission"("id") 
            ON DELETE CASCADE;
    END IF;
END $$;

-- Foreign key for ministry_indicator_score_history
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_ministry_indicator_score_history_submission'
    ) THEN
        ALTER TABLE "ministry_indicator_score_history" 
            ADD CONSTRAINT "fk_ministry_indicator_score_history_submission" 
            FOREIGN KEY ("submissionId") 
            REFERENCES "ministry_submission"("id") 
            ON DELETE CASCADE;
    END IF;
END $$;

-- Foreign key for ministry_final_scores
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_ministry_final_scores_submission'
    ) THEN
        ALTER TABLE "ministry_final_scores" 
            ADD CONSTRAINT "fk_ministry_final_scores_submission" 
            FOREIGN KEY ("submissionId") 
            REFERENCES "ministry_submission"("id") 
            ON DELETE CASCADE;
    END IF;
END $$;

-- Foreign key for ministry_manual_score_updates
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_ministry_manual_score_updates_submission'
    ) THEN
        ALTER TABLE "ministry_manual_score_updates" 
            ADD CONSTRAINT "fk_ministry_manual_score_updates_submission" 
            FOREIGN KEY ("submissionId") 
            REFERENCES "ministry_submission"("id") 
            ON DELETE CASCADE;
    END IF;
END $$;
*/

-- =====================================================
-- 8. ADD COMMENTS FOR DOCUMENTATION
-- =====================================================
-- Table comments
COMMENT ON TABLE "ministry_indicator_scores" IS 'Stores calculated scores for each indicator in ministry submissions';
COMMENT ON TABLE "ministry_indicator_score_history" IS 'Stores historical changes to ministry indicator scores for audit trail';
COMMENT ON TABLE "ministry_final_scores" IS 'Stores aggregated final scores for ministry submissions';
COMMENT ON TABLE "ministry_manual_score_updates" IS 'Stores manual score updates made by MOSPI_APPROVER for ministry submissions. System-generated scores remain in ministry_indicator_scores table and are not modified.';

-- Column comments for ministry_indicator_scores
COMMENT ON COLUMN "ministry_indicator_scores"."submissionId" IS 'References ministry_submission.id (UUID)';
COMMENT ON COLUMN "ministry_indicator_scores"."indicatorCode" IS 'Indicator code (e.g., "1.1", "2.3", etc.)';
COMMENT ON COLUMN "ministry_indicator_scores"."category" IS 'Category name (e.g., "infraFinancing", "infraDevelopment", etc.)';
COMMENT ON COLUMN "ministry_indicator_scores"."calculation" IS 'JSON object containing calculation details';

-- Column comments for ministry_indicator_score_history
COMMENT ON COLUMN "ministry_indicator_score_history"."previousScore" IS 'Previous score before this update';
COMMENT ON COLUMN "ministry_indicator_score_history"."scoreChange" IS 'Difference from previous score';
COMMENT ON COLUMN "ministry_indicator_score_history"."formDataSnapshot" IS 'Snapshot of formData at time of update';
COMMENT ON COLUMN "ministry_indicator_score_history"."updateReason" IS 'Reason for update (e.g., "INDICATOR_SUBMITTED", "INDICATOR_UPDATED")';

-- Column comments for ministry_final_scores
COMMENT ON COLUMN "ministry_final_scores"."submissionId" IS 'References ministry_submission.id (UUID)';
COMMENT ON COLUMN "ministry_final_scores"."ministryId" IS 'Ministry identifier';
COMMENT ON COLUMN "ministry_final_scores"."totalScore" IS 'Total aggregated score across all indicators';
COMMENT ON COLUMN "ministry_final_scores"."scoreBreakdown" IS 'JSON object containing detailed score breakdown by indicator';
COMMENT ON COLUMN "ministry_final_scores"."categoryScores" IS 'JSON object containing scores by category (infraFinancing, infraDevelopment, etc.)';
COMMENT ON COLUMN "ministry_final_scores"."calculationMethodology" IS 'Description of the scoring methodology used';

-- Column comments for ministry_manual_score_updates
COMMENT ON COLUMN "ministry_manual_score_updates"."systemScore" IS 'The original system-generated score at the time of manual update';
COMMENT ON COLUMN "ministry_manual_score_updates"."manualUpdatedScore" IS 'The manually entered score by MOSPI_APPROVER';
COMMENT ON COLUMN "ministry_manual_score_updates"."updateReason" IS 'Reason provided by user for the manual update';

-- =====================================================
-- 9. VERIFICATION SUMMARY
-- =====================================================
-- Display summary of created tables
SELECT 
    '✅ Migration Status' as status,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ministry_indicator_scores') 
        THEN '✅' ELSE '❌' END || ' ministry_indicator_scores' as table_1,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ministry_indicator_score_history') 
        THEN '✅' ELSE '❌' END || ' ministry_indicator_score_history' as table_2,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ministry_final_scores') 
        THEN '✅' ELSE '❌' END || ' ministry_final_scores' as table_3,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ministry_manual_score_updates') 
        THEN '✅' ELSE '❌' END || ' ministry_manual_score_updates' as table_4;

