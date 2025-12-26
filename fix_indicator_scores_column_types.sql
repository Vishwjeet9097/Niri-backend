-- =====================================================
-- Fix Column Types for Foreign Key Constraints
-- =====================================================
-- This script changes submissionId columns from VARCHAR to UUID
-- to match the submissions.id column type
-- =====================================================

-- Step 1: Change indicator_scores.submissionId to UUID
DO $$ 
BEGIN
    -- Check if column exists and is not already UUID
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'indicator_scores' 
        AND column_name = 'submissionId'
        AND data_type != 'uuid'
    ) THEN
        -- First, ensure all existing values are valid UUIDs (or NULL)
        -- Delete any rows with invalid UUIDs
        DELETE FROM "indicator_scores" 
        WHERE "submissionId" IS NOT NULL 
        AND "submissionId" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
        
        -- Alter column type to UUID
        ALTER TABLE "indicator_scores" 
            ALTER COLUMN "submissionId" TYPE uuid USING "submissionId"::uuid;
        
        RAISE NOTICE 'Changed indicator_scores.submissionId to UUID type';
    ELSE
        RAISE NOTICE 'indicator_scores.submissionId is already UUID or does not exist';
    END IF;
END $$;

-- Step 2: Change indicator_score_history.submissionId to UUID
DO $$ 
BEGIN
    -- Check if column exists and is not already UUID
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'indicator_score_history' 
        AND column_name = 'submissionId'
        AND data_type != 'uuid'
    ) THEN
        -- First, ensure all existing values are valid UUIDs (or NULL)
        -- Delete any rows with invalid UUIDs
        DELETE FROM "indicator_score_history" 
        WHERE "submissionId" IS NOT NULL 
        AND "submissionId" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
        
        -- Alter column type to UUID
        ALTER TABLE "indicator_score_history" 
            ALTER COLUMN "submissionId" TYPE uuid USING "submissionId"::uuid;
        
        RAISE NOTICE 'Changed indicator_score_history.submissionId to UUID type';
    ELSE
        RAISE NOTICE 'indicator_score_history.submissionId is already UUID or does not exist';
    END IF;
END $$;

-- Step 3: Verify column types
SELECT 
    table_name,
    column_name,
    data_type,
    udt_name
FROM information_schema.columns
WHERE table_name IN ('indicator_scores', 'indicator_score_history')
AND column_name = 'submissionId'
ORDER BY table_name;

-- =====================================================
-- VERIFICATION COMPLETE
-- =====================================================
SELECT 'Column types updated successfully!' as status;

