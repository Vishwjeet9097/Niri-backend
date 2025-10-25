-- =====================================================
-- Fix User Indicator Scope Table Columns
-- =====================================================
-- यह script existing user_indicator_scope table को fix करता है
-- Date: 2025-01-23
-- =====================================================

-- Check if table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_indicator_scope') THEN
        
        -- Add createdAt column if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'user_indicator_scope' 
            AND column_name = 'createdAt'
        ) THEN
            ALTER TABLE "user_indicator_scope" 
            ADD COLUMN "createdAt" TIMESTAMP NOT NULL DEFAULT now();
        END IF;

        -- Add updatedAt column if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'user_indicator_scope' 
            AND column_name = 'updatedAt'
        ) THEN
            ALTER TABLE "user_indicator_scope" 
            ADD COLUMN "updatedAt" TIMESTAMP NOT NULL DEFAULT now();
        END IF;

        -- Remove old created_at column if it exists
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'user_indicator_scope' 
            AND column_name = 'created_at'
        ) THEN
            ALTER TABLE "user_indicator_scope" 
            DROP COLUMN "created_at";
        END IF;

        -- Remove old updated_at column if it exists
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'user_indicator_scope' 
            AND column_name = 'updated_at'
        ) THEN
            ALTER TABLE "user_indicator_scope" 
            DROP COLUMN "updated_at";
        END IF;

        RAISE NOTICE 'User indicator scope table columns fixed successfully!';
    ELSE
        RAISE NOTICE 'User indicator scope table does not exist. Please run the main setup script first.';
    END IF;
END $$;

-- Verify the fix
SELECT 
    'Column Check' as category,
    column_name as status
FROM information_schema.columns 
WHERE table_name = 'user_indicator_scope' 
AND column_name IN ('createdAt', 'updatedAt', 'created_at', 'updated_at')
ORDER BY column_name;
