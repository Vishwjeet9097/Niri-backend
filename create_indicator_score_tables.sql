-- =====================================================
-- NIRI Backend - Indicator Score Tables Migration
-- =====================================================
-- This script creates tables for per-indicator scoring
-- and score history tracking
-- Date: 2025-01-XX
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. CREATE INDICATOR_SCORES TABLE
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
-- 2. CREATE INDICATOR_SCORE_HISTORY TABLE
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
-- 3. ADD FOREIGN KEY CONSTRAINTS WITH CASCADE DELETE
-- =====================================================

-- Add foreign key for indicator_scores (references submissions.id)
-- Note: submissionId in indicator_scores stores the UUID from submissions.id
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'indicator_scores_submission_id_fkey'
    ) THEN
        ALTER TABLE "indicator_scores" 
            ADD CONSTRAINT "indicator_scores_submission_id_fkey" 
            FOREIGN KEY ("submissionId") 
            REFERENCES "submissions"("id") 
            ON DELETE CASCADE;
    END IF;
END $$;

-- Add foreign key for indicator_score_history (references submissions.id)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'indicator_score_history_submission_id_fkey'
    ) THEN
        ALTER TABLE "indicator_score_history" 
            ADD CONSTRAINT "indicator_score_history_submission_id_fkey" 
            FOREIGN KEY ("submissionId") 
            REFERENCES "submissions"("id") 
            ON DELETE CASCADE;
    END IF;
END $$;

-- =====================================================
-- 4. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Indicator Scores indexes
CREATE INDEX IF NOT EXISTS "idx_indicator_scores_submission_indicator" 
    ON "indicator_scores" ("submissionId", "indicatorCode");
CREATE INDEX IF NOT EXISTS "idx_indicator_scores_submission" 
    ON "indicator_scores" ("submissionId");
CREATE INDEX IF NOT EXISTS "idx_indicator_scores_indicator" 
    ON "indicator_scores" ("indicatorCode");

-- Indicator Score History indexes
CREATE INDEX IF NOT EXISTS "idx_indicator_score_history_submission_indicator" 
    ON "indicator_score_history" ("submissionId", "indicatorCode");
CREATE INDEX IF NOT EXISTS "idx_indicator_score_history_submission" 
    ON "indicator_score_history" ("submissionId");
CREATE INDEX IF NOT EXISTS "idx_indicator_score_history_indicator" 
    ON "indicator_score_history" ("indicatorCode");
CREATE INDEX IF NOT EXISTS "idx_indicator_score_history_created_at" 
    ON "indicator_score_history" ("createdAt");

-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT 'Indicator score tables created successfully!' as status;
SELECT COUNT(*) as "Total Tables" FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('indicator_scores', 'indicator_score_history');

