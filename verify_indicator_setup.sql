-- =====================================================
-- NIRI Backend - Indicator Database Verification Script
-- =====================================================
-- This script verifies that all indicator-related database
-- changes have been applied correctly
-- Date: 2025-01-23
-- =====================================================

-- Check if all required tables exist
SELECT 
    'Tables Check' as category,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'indicators') THEN '✅ indicators table exists'
        ELSE '❌ indicators table missing'
    END as status
UNION ALL
SELECT 
    'Tables Check' as category,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'states') THEN '✅ states table exists'
        ELSE '❌ states table missing'
    END as status
UNION ALL
SELECT 
    'Tables Check' as category,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_indicator_scope') THEN '✅ user_indicator_scope table exists'
        ELSE '❌ user_indicator_scope table missing'
    END as status
UNION ALL
SELECT 
    'Tables Check' as category,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'submissions' AND column_name = 'indicator_comment') THEN '✅ indicator_comment column exists in submissions'
        ELSE '❌ indicator_comment column missing in submissions'
    END as status;

-- Check data counts
SELECT 
    'Data Counts' as category,
    'Indicators: ' || COUNT(*) as status
FROM indicators
UNION ALL
SELECT 
    'Data Counts' as category,
    'States: ' || COUNT(*) as status
FROM states
UNION ALL
SELECT 
    'Data Counts' as category,
    'User Indicator Scopes: ' || COUNT(*) as status
FROM user_indicator_scope;

-- Check indicators by category
SELECT 
    'Indicators by Category' as category,
    category || ': ' || COUNT(*) as status
FROM indicators
GROUP BY category
ORDER BY category;

-- Check states by type (approximate)
SELECT 
    'States by Type' as category,
    CASE 
        WHEN name IN ('Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry') THEN 'Union Territory'
        ELSE 'State'
    END as state_type,
    COUNT(*) as count
FROM states
GROUP BY 
    CASE 
        WHEN name IN ('Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry') THEN 'Union Territory'
        ELSE 'State'
    END;

-- Check foreign key constraints
SELECT 
    'Foreign Keys' as category,
    constraint_name || ': ' || table_name || '.' || column_name as status
FROM information_schema.key_column_usage
WHERE constraint_name LIKE 'FK_user_indicator_scope%'
ORDER BY constraint_name;

-- Check indexes
SELECT 
    'Indexes' as category,
    indexname as status
FROM pg_indexes
WHERE tablename IN ('indicators', 'states', 'user_indicator_scope')
ORDER BY tablename, indexname;

-- Final verification summary
SELECT 
    'VERIFICATION SUMMARY' as category,
    CASE 
        WHEN (SELECT COUNT(*) FROM indicators) = 20 
         AND (SELECT COUNT(*) FROM states) = 36
         AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_indicator_scope')
         AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'submissions' AND column_name = 'indicator_comment')
        THEN '✅ ALL INDICATOR CHANGES APPLIED SUCCESSFULLY!'
        ELSE '❌ SOME CHANGES MISSING - PLEASE CHECK ABOVE'
    END as status;
