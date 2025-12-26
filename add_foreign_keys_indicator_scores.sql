-- =====================================================
-- Add Foreign Key Constraints with CASCADE DELETE
-- for indicator_scores and indicator_score_history tables
-- =====================================================
-- This script adds foreign key constraints to ensure
-- that when a submission is deleted, all related
-- indicator scores and history records are automatically deleted
-- 
-- IMPORTANT: Run fix_indicator_scores_column_types.sql FIRST
-- to change submissionId columns from VARCHAR to UUID
-- =====================================================

-- Step 1: Ensure column types are UUID (run fix script if needed)
DO $$ 
BEGIN
    -- Check indicator_scores
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'indicator_scores' 
        AND column_name = 'submissionId'
        AND data_type != 'uuid'
    ) THEN
        RAISE EXCEPTION 'indicator_scores.submissionId is not UUID type. Please run fix_indicator_scores_column_types.sql first.';
    END IF;
    
    -- Check indicator_score_history
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'indicator_score_history' 
        AND column_name = 'submissionId'
        AND data_type != 'uuid'
    ) THEN
        RAISE EXCEPTION 'indicator_score_history.submissionId is not UUID type. Please run fix_indicator_scores_column_types.sql first.';
    END IF;
END $$;

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
        
        RAISE NOTICE 'Foreign key constraint added: indicator_scores_submission_id_fkey';
    ELSE
        RAISE NOTICE 'Foreign key constraint already exists: indicator_scores_submission_id_fkey';
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
        
        RAISE NOTICE 'Foreign key constraint added: indicator_score_history_submission_id_fkey';
    ELSE
        RAISE NOTICE 'Foreign key constraint already exists: indicator_score_history_submission_id_fkey';
    END IF;
END $$;

-- Verify constraints were added
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
    'indicator_score_history_submission_id_fkey'
)
ORDER BY conname;

-- =====================================================
-- VERIFICATION COMPLETE
-- =====================================================
SELECT 'Foreign key constraints added successfully!' as status;

