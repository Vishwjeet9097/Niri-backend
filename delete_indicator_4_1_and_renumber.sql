-- =====================================================
-- NIRI Backend - Delete Indicator 4.1 and Renumber Script
-- =====================================================
-- This script:
-- 1. Deletes indicator 4.1 (All Eligible Infra Projects on NIP Portal)
-- 2. Renumbers remaining indicators: 4.2→4.1, 4.3→4.2, 4.4→4.3, 4.5→4.4, 4.6→4.5
-- 
-- IMPORTANT: 
-- - This script will permanently delete indicator 4.1 and all its assignments
-- - Make sure to backup your database before running this script
-- - The scoring service has been kept unchanged (as per requirements)
-- 
-- Date: 2025-01-27
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: VERIFY INDICATOR 4.1 EXISTS
-- =====================================================
DO $$
DECLARE
    indicator_4_1_id UUID;
    indicator_4_1_count INTEGER;
BEGIN
    -- Check if indicator 4.1 exists
    SELECT COUNT(*) INTO indicator_4_1_count
    FROM indicators
    WHERE code = '4.1' AND indicator_name = 'All Eligible Infra Projects on NIP Portal';
    
    IF indicator_4_1_count = 0 THEN
        RAISE NOTICE 'WARNING: Indicator 4.1 not found. It may have already been deleted.';
    ELSE
        RAISE NOTICE 'Found indicator 4.1. Proceeding with deletion...';
    END IF;
END $$;

-- =====================================================
-- STEP 2: DELETE USER INDICATOR SCOPE ENTRIES FOR 4.1
-- =====================================================
-- Delete all user_indicator_scope entries that reference indicator 4.1
DELETE FROM user_indicator_scope
WHERE indicator_id IN (
    SELECT id 
    FROM indicators 
    WHERE code = '4.1' 
    AND indicator_name = 'All Eligible Infra Projects on NIP Portal'
);

-- Log the deletion
DO $$
DECLARE
    deleted_scopes INTEGER;
BEGIN
    GET DIAGNOSTICS deleted_scopes = ROW_COUNT;
    RAISE NOTICE 'Deleted % user_indicator_scope entries for indicator 4.1', deleted_scopes;
END $$;

-- =====================================================
-- STEP 3: DELETE INDICATOR 4.1
-- =====================================================
DELETE FROM indicators
WHERE code = '4.1' 
AND indicator_name = 'All Eligible Infra Projects on NIP Portal';

-- Log the deletion
DO $$
DECLARE
    deleted_indicators INTEGER;
BEGIN
    GET DIAGNOSTICS deleted_indicators = ROW_COUNT;
    IF deleted_indicators = 0 THEN
        RAISE NOTICE 'WARNING: No indicator 4.1 was deleted. It may not exist.';
    ELSE
        RAISE NOTICE 'Deleted indicator 4.1 successfully';
    END IF;
END $$;

-- =====================================================
-- STEP 4: RENUMBER REMAINING INDICATORS
-- =====================================================
-- Update 4.2 → 4.1
UPDATE indicators 
SET code = '4.1',
    updated_at = CURRENT_TIMESTAMP
WHERE code = '4.2' 
AND indicator_name = 'Availability & Use of State/UT PMG';

-- Update 4.3 → 4.2
UPDATE indicators 
SET code = '4.2',
    updated_at = CURRENT_TIMESTAMP
WHERE code = '4.3' 
AND indicator_name = 'Adoption of PM GatiShakti';

-- Update 4.4 → 4.3
UPDATE indicators 
SET code = '4.3',
    updated_at = CURRENT_TIMESTAMP
WHERE code = '4.4' 
AND indicator_name = 'Adoption of ADR';

-- Update 4.5 → 4.4
UPDATE indicators 
SET code = '4.4',
    updated_at = CURRENT_TIMESTAMP
WHERE code = '4.5' 
AND indicator_name = 'Innovative Practices';

-- Update 4.6 → 4.5
UPDATE indicators 
SET code = '4.5',
    updated_at = CURRENT_TIMESTAMP
WHERE code = '4.6' 
AND indicator_name = 'Capacity Building - Officer Participation';

-- Log the renumbering
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO updated_count
    FROM indicators
    WHERE code IN ('4.1', '4.2', '4.3', '4.4', '4.5')
    AND section_id = '4';
    
    RAISE NOTICE 'Renumbered % indicators in section 4', updated_count;
END $$;

-- =====================================================
-- STEP 5: VERIFICATION QUERIES
-- =====================================================
-- Show current indicators in section 4
SELECT 
    '=== CURRENT INDICATORS IN SECTION 4 ===' as status;

SELECT 
    code,
    indicator_name,
    category,
    max_score,
    is_active
FROM indicators
WHERE section_id = '4'
ORDER BY code;

-- Count indicators by section
SELECT 
    '=== INDICATOR COUNT BY SECTION ===' as status;

SELECT 
    section_id,
    COUNT(*) as indicator_count
FROM indicators
GROUP BY section_id
ORDER BY section_id;

-- Check for any remaining references to old indicator codes
SELECT 
    '=== CHECKING FOR ORPHANED USER_INDICATOR_SCOPE ENTRIES ===' as status;

SELECT 
    COUNT(*) as orphaned_scopes
FROM user_indicator_scope uis
LEFT JOIN indicators i ON uis.indicator_id = i.id
WHERE i.id IS NULL;

-- If there are orphaned scopes, show them
DO $$
DECLARE
    orphaned_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphaned_count
    FROM user_indicator_scope uis
    LEFT JOIN indicators i ON uis.indicator_id = i.id
    WHERE i.id IS NULL;
    
    IF orphaned_count > 0 THEN
        RAISE WARNING 'Found % orphaned user_indicator_scope entries. These should be cleaned up.', orphaned_count;
    ELSE
        RAISE NOTICE 'No orphaned user_indicator_scope entries found. Database is clean.';
    END IF;
END $$;

-- =====================================================
-- COMMIT TRANSACTION
-- =====================================================
COMMIT;

-- =====================================================
-- FINAL SUMMARY
-- =====================================================
SELECT '=== SCRIPT EXECUTION COMPLETED ===' as final_status;

SELECT 
    'Summary:' as category,
    COUNT(*) FILTER (WHERE section_id = '4') as section_4_indicators,
    COUNT(*) as total_indicators
FROM indicators;

