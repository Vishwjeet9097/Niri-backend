-- =====================================================
-- ALTER Commands for Missing Fields
-- =====================================================
-- यह script missing columns को add करता है
-- Date: 2025-01-23
-- =====================================================

-- 1. Add createdAt column to user_indicator_scope table
ALTER TABLE "user_indicator_scope" 
ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP NOT NULL DEFAULT now();

-- 2. Add updatedAt column to user_indicator_scope table  
ALTER TABLE "user_indicator_scope" 
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP NOT NULL DEFAULT now();

-- 3. Add is_active column to user_indicator_scope table (if missing)
ALTER TABLE "user_indicator_scope" 
ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true;

-- 4. Add indicator_comment column to submissions table (if missing)
ALTER TABLE "submissions" 
ADD COLUMN IF NOT EXISTS "indicator_comment" jsonb DEFAULT '{}';

-- 5. Update existing records to have proper timestamps
UPDATE "user_indicator_scope" 
SET "createdAt" = now() 
WHERE "createdAt" IS NULL;

UPDATE "user_indicator_scope" 
SET "updatedAt" = now() 
WHERE "updatedAt" IS NULL;

-- 6. Verify the changes
SELECT 
    'Column Check' as category,
    column_name as status
FROM information_schema.columns 
WHERE table_name = 'user_indicator_scope' 
AND column_name IN ('createdAt', 'updatedAt', 'is_active')
ORDER BY column_name;

-- 7. Check submissions table
SELECT 
    'Submissions Column Check' as category,
    column_name as status
FROM information_schema.columns 
WHERE table_name = 'submissions' 
AND column_name = 'indicator_comment';

-- 8. Final verification
SELECT 'ALTER Commands Completed Successfully!' as status;
