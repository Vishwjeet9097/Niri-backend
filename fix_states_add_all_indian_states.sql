-- =====================================================
-- COMPLETE FIX: Add missing Indian States with proper codes
-- =====================================================
-- This script ensures all Indian states have proper codes
-- Run this BEFORE the migration that adds NOT NULL constraint
-- Date: 2025-11-13
-- =====================================================

-- First, let's check what's in the states table
SELECT 
    'Current states table structure and data:' as info,
    *
FROM states
LIMIT 10;

-- Check for NULL codes
SELECT 
    'States with NULL code:' as info,
    id, name, code, type, "isActive"
FROM states 
WHERE code IS NULL;

-- =====================================================
-- FIX: Insert all Indian States and Union Territories with codes
-- =====================================================

-- If the table is empty or has incomplete data, insert all states
INSERT INTO states (id, code, name, type, "isActive", "createdAt", "updatedAt") 
VALUES
-- States (28) - using 'ST' for State (max 2 chars)
(gen_random_uuid(), 'AP', 'Andhra Pradesh', 'ST', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'AR', 'Arunachal Pradesh', 'ST', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'AS', 'Assam', 'ST', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'BR', 'Bihar', 'ST', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'CG', 'Chhattisgarh', 'ST', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'GA', 'Goa', 'ST', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'GJ', 'Gujarat', 'ST', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'HR', 'Haryana', 'ST', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'HP', 'Himachal Pradesh', 'ST', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'JH', 'Jharkhand', 'ST', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'KA', 'Karnataka', 'ST', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'KL', 'Kerala', 'ST', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'MP', 'Madhya Pradesh', 'ST', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'MH', 'Maharashtra', 'ST', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'MN', 'Manipur', 'ST', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'ML', 'Meghalaya', 'ST', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'MZ', 'Mizoram', 'ST', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'NL', 'Nagaland', 'ST', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'OR', 'Odisha', 'ST', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'PB', 'Punjab', 'ST', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'RJ', 'Rajasthan', 'ST', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'SK', 'Sikkim', 'ST', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'TN', 'Tamil Nadu', 'ST', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'TG', 'Telangana', 'ST', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'TR', 'Tripura', 'ST', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'UP', 'Uttar Pradesh', 'ST', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'UK', 'Uttarakhand', 'ST', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'WB', 'West Bengal', 'ST', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Union Territories (8) - using 'UT' for Union Territory
(gen_random_uuid(), 'AN', 'Andaman and Nicobar Islands', 'UT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'CH', 'Chandigarh', 'UT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'DN', 'Dadra and Nagar Haveli and Daman and Diu', 'UT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'DL', 'Delhi', 'UT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'JK', 'Jammu and Kashmir', 'UT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'LA', 'Ladakh', 'UT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'LD', 'Lakshadweep', 'UT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'PY', 'Puducherry', 'UT', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)

ON CONFLICT (code) DO NOTHING; -- Skip if code already exists

-- Update any existing rows that have NULL codes
-- If you have specific rows you want to update, modify this section
-- Example: UPDATE states SET code = 'XX' WHERE id = 'specific-id' AND code IS NULL;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Verify no NULL codes remain
SELECT 
    'Verification after fix:' as status,
    COUNT(*) as null_code_count
FROM states 
WHERE code IS NULL;

-- Show all states
SELECT 
    'All states with codes:' as status,
    code, name, type, "isActive"
FROM states 
ORDER BY code;

-- Final check
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'SUCCESS: All states have codes. Safe to run migration.'
        ELSE 'ERROR: Still ' || COUNT(*) || ' states with NULL codes!'
    END as final_status
FROM states 
WHERE code IS NULL;
