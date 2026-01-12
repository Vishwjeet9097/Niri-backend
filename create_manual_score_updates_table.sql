-- =====================================================
-- CREATE MANUAL_SCORE_UPDATES TABLE
-- This table stores manual score updates separately from system-generated scores
-- =====================================================
CREATE TABLE IF NOT EXISTS "manual_score_updates" (
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
    CONSTRAINT "manual_score_updates_pkey" PRIMARY KEY ("id")
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "IDX_manual_score_updates_submission_indicator" 
    ON "manual_score_updates" ("submissionId", "indicatorCode");
    
CREATE INDEX IF NOT EXISTS "IDX_manual_score_updates_submission" 
    ON "manual_score_updates" ("submissionId");
    
CREATE INDEX IF NOT EXISTS "IDX_manual_score_updates_indicator" 
    ON "manual_score_updates" ("indicatorCode");
    
CREATE INDEX IF NOT EXISTS "IDX_manual_score_updates_created" 
    ON "manual_score_updates" ("createdAt");

-- Add comments for documentation
COMMENT ON TABLE "manual_score_updates" IS 'Stores manual score updates made by MOSPI_APPROVER. System-generated scores remain in indicator_scores table and are not modified.';
COMMENT ON COLUMN "manual_score_updates"."systemScore" IS 'The original system-generated score at the time of manual update';
COMMENT ON COLUMN "manual_score_updates"."manualUpdatedScore" IS 'The manually entered score by MOSPI_APPROVER';
COMMENT ON COLUMN "manual_score_updates"."updateReason" IS 'Reason provided by user for the manual update';

