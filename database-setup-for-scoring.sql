-- NIRI Scoring System Database Setup Script
-- This script sets up all required database changes for the scoring system

-- ==========================================
-- STEP 1: Check Current Database State
-- ==========================================
SELECT '=== CHECKING CURRENT DATABASE STATE ===' as step;

-- Check if final_scores table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'final_scores'
) as final_scores_exists;

-- Check current enum values
SELECT 'Current Status Enum Values:' as info;
SELECT enumlabel as enum_value 
FROM pg_enum 
WHERE enumtypid = (
    SELECT oid 
    FROM pg_type 
    WHERE typname = 'submissions_status_enum'
)
ORDER BY enumlabel;

-- ==========================================
-- STEP 2: Create Final Scores Table (if not exists)
-- ==========================================
SELECT '=== CREATING FINAL SCORES TABLE ===' as step;

CREATE TABLE IF NOT EXISTS final_scores (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id uuid UNIQUE NOT NULL,
    state_ut varchar NOT NULL,
    total_score numeric(10,2) NOT NULL,
    score_breakdown jsonb NOT NULL,
    calculation_methodology text NOT NULL,
    approved_by varchar NOT NULL,
    category_scores jsonb,
    scoring_version varchar DEFAULT '2.0',
    "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS IDX_final_scores_state_ut ON final_scores (state_ut);
CREATE INDEX IF NOT EXISTS IDX_final_scores_total_score ON final_scores (total_score);
CREATE INDEX IF NOT EXISTS IDX_final_scores_created_at ON final_scores ("createdAt");
CREATE INDEX IF NOT EXISTS IDX_final_scores_scoring_version ON final_scores (scoring_version);

-- Add foreign key constraint
ALTER TABLE final_scores 
ADD CONSTRAINT IF NOT EXISTS FK_final_scores_submission_id 
FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE;

-- Add table comment
COMMENT ON TABLE final_scores IS 'Stores calculated scores for NIRI submissions with detailed breakdown and methodology';

-- ==========================================
-- STEP 3: Update Submission Status Enum
-- ==========================================
SELECT '=== UPDATING SUBMISSION STATUS ENUM ===' as step;

-- Update existing data first
UPDATE submissions 
SET status = 'SUBMITTED_TO_MOSPI_REVIEWER' 
WHERE status = 'SUBMITTED_TO_MOSPI';

-- Add new enum values (one by one to avoid conflicts)
DO $$ 
BEGIN
    -- Add SUBMITTED_TO_MOSPI_REVIEWER if not exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'submissions_status_enum')
        AND enumlabel = 'SUBMITTED_TO_MOSPI_REVIEWER'
    ) THEN
        ALTER TYPE submissions_status_enum ADD VALUE 'SUBMITTED_TO_MOSPI_REVIEWER';
    END IF;

    -- Add SUBMITTED_TO_MOSPI_APPROVER if not exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'submissions_status_enum')
        AND enumlabel = 'SUBMITTED_TO_MOSPI_APPROVER'
    ) THEN
        ALTER TYPE submissions_status_enum ADD VALUE 'SUBMITTED_TO_MOSPI_APPROVER';
    END IF;

    -- Add DRAFT if not exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'submissions_status_enum')
        AND enumlabel = 'DRAFT'
    ) THEN
        ALTER TYPE submissions_status_enum ADD VALUE 'DRAFT';
    END IF;

    -- Add REJECTED if not exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'submissions_status_enum')
        AND enumlabel = 'REJECTED'
    ) THEN
        ALTER TYPE submissions_status_enum ADD VALUE 'REJECTED';
    END IF;

    -- Add REJECTED_FINAL if not exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'submissions_status_enum')
        AND enumlabel = 'REJECTED_FINAL'
    ) THEN
        ALTER TYPE submissions_status_enum ADD VALUE 'REJECTED_FINAL';
    END IF;

    -- Add RETURNED_FROM_STATE if not exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'submissions_status_enum')
        AND enumlabel = 'RETURNED_FROM_STATE'
    ) THEN
        ALTER TYPE submissions_status_enum ADD VALUE 'RETURNED_FROM_STATE';
    END IF;

    -- Add RETURNED_FROM_MOSPI if not exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'submissions_status_enum')
        AND enumlabel = 'RETURNED_FROM_MOSPI'
    ) THEN
        ALTER TYPE submissions_status_enum ADD VALUE 'RETURNED_FROM_MOSPI';
    END IF;
END $$;

-- ==========================================
-- STEP 4: Update Existing Data
-- ==========================================
SELECT '=== UPDATING EXISTING DATA ===' as step;

-- Update any NULL or empty status values to DRAFT
UPDATE submissions 
SET status = 'DRAFT' 
WHERE status IS NULL OR status = '';

-- Update existing final_scores to have scoring version 1.0
UPDATE final_scores 
SET scoring_version = '1.0' 
WHERE scoring_version IS NULL;

-- ==========================================
-- STEP 5: Verify Changes
-- ==========================================
SELECT '=== VERIFICATION ===' as step;

-- Check final_scores table structure
SELECT 'Final Scores Table Structure:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'final_scores' 
ORDER BY ordinal_position;

-- Check updated enum values
SELECT 'Updated Status Enum Values:' as info;
SELECT enumlabel as enum_value 
FROM pg_enum 
WHERE enumtypid = (
    SELECT oid 
    FROM pg_type 
    WHERE typname = 'submissions_status_enum'
)
ORDER BY enumlabel;

-- Check data distribution
SELECT 'Submission Status Distribution:' as info;
SELECT status, COUNT(*) as count 
FROM submissions 
GROUP BY status 
ORDER BY status;

-- Check final_scores data
SELECT 'Final Scores Count:' as info;
SELECT COUNT(*) as total_scores, 
       COUNT(CASE WHEN scoring_version = '2.0' THEN 1 END) as new_version_scores,
       COUNT(CASE WHEN scoring_version = '1.0' THEN 1 END) as old_version_scores
FROM final_scores;

-- ==========================================
-- STEP 6: Success Message
-- ==========================================
SELECT '=== DATABASE SETUP COMPLETED SUCCESSFULLY ===' as result;
SELECT 'NIRI Scoring System is now ready for use!' as message;
