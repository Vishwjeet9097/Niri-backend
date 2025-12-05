-- =====================================================
-- Fix NULL values in states.code column
-- =====================================================
-- This script updates any NULL values in the states table
-- before applying NOT NULL constraint
-- Date: 2025-11-13
-- =====================================================

-- First, check if there are any NULL values
SELECT 
    'States with NULL code:' as info,
    COUNT(*) as count
FROM states 
WHERE code IS NULL;

-- Display the rows with NULL code (if any)
SELECT * FROM states WHERE code IS NULL;

-- Option 1: Delete rows with NULL code (if they're invalid)
-- Uncomment the line below if you want to delete these rows:
-- DELETE FROM states WHERE code IS NULL;

-- Option 2: Update NULL codes with placeholder values
-- Uncomment and modify the lines below if you want to keep the rows:
-- UPDATE states SET code = 'UNKNOWN' WHERE code IS NULL AND id = 'specific-id';

-- After fixing, verify no NULL values remain
SELECT 
    'Verification - States with NULL code:' as info,
    COUNT(*) as count
FROM states 
WHERE code IS NULL;

-- Show all states
SELECT 
    id, 
    code, 
    name, 
    type, 
    "isActive"
FROM states 
ORDER BY code;
