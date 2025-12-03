-- =====================================================
-- STEP-BY-STEP FIX FOR: column "code" of relation "states" contains null values
-- =====================================================
-- Run this script BEFORE running the migration
-- Date: 2025-11-13
-- =====================================================

-- STEP 1: Check current state of the states table
SELECT 
    'STEP 1: Current states with NULL code' as step,
    COUNT(*) as null_code_count
FROM states 
WHERE code IS NULL;

-- STEP 2: Display all states to see the data
SELECT 
    'STEP 2: All states in database' as step,
    id, 
    code, 
    name, 
    type, 
    "isActive",
    "createdAt"
FROM states 
ORDER BY COALESCE(code, ''), name;

-- =====================================================
-- CHOOSE ONE OF THE FOLLOWING OPTIONS:
-- =====================================================

-- OPTION A: Delete states with NULL codes (if they're invalid/incomplete data)
-- Uncomment the following lines if you want to DELETE these rows:

-- BEGIN;
-- DELETE FROM states WHERE code IS NULL;
-- SELECT 'OPTION A: Deleted states with NULL codes' as action, COUNT(*) as remaining_states FROM states;
-- COMMIT;

-- =====================================================

-- OPTION B: Assign default codes to NULL entries (if you want to keep them)
-- Uncomment and modify the following section if you want to KEEP these rows:

-- BEGIN;
-- 
-- -- Update each row individually with appropriate codes
-- -- Example: If you have states without codes, assign them proper state codes
-- UPDATE states 
-- SET code = 'UK' -- Replace with actual code
-- WHERE code IS NULL AND name = 'Unknown'; -- Replace with actual name
--
-- -- Add more UPDATE statements as needed for each NULL code row
-- 
-- SELECT 'OPTION B: Updated states with codes' as action;
-- COMMIT;

-- =====================================================

-- STEP 3: Verify no NULL codes remain
SELECT 
    'STEP 3: Verification - States with NULL code after fix' as step,
    COUNT(*) as null_code_count
FROM states 
WHERE code IS NULL;

-- STEP 4: If count is 0, you can now run the migration successfully
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'SUCCESS: Ready to run migration - no NULL codes found'
        ELSE 'WARNING: Still have ' || COUNT(*) || ' NULL codes - fix them before running migration'
    END as status
FROM states 
WHERE code IS NULL;
