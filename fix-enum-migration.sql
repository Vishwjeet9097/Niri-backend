-- Complete Enum Migration Script for NIRI Backend
-- This script updates ALL existing data to match new enum values

-- Step 1: Check current status values in database
SELECT 'BEFORE MIGRATION - Current Status Values:' as info;
SELECT status, COUNT(*) as count 
FROM submissions 
GROUP BY status 
ORDER BY status;

-- Step 2: Update all old status values to new enum values
-- Update SUBMITTED_TO_MOSPI to SUBMITTED_TO_MOSPI_REVIEWER
UPDATE submissions 
SET status = 'SUBMITTED_TO_MOSPI_REVIEWER' 
WHERE status = 'SUBMITTED_TO_MOSPI';

-- Update any other potential old values (if they exist)
-- Note: These are the valid enum values after migration:
-- DRAFT, SUBMITTED_TO_STATE, SUBMITTED_TO_MOSPI_REVIEWER, 
-- SUBMITTED_TO_MOSPI_APPROVER, REJECTED_TO_STATE, REJECTED_FINAL, APPROVED

-- Step 3: Verify all updates
SELECT 'AFTER MIGRATION - Updated Status Values:' as info;
SELECT status, COUNT(*) as count 
FROM submissions 
GROUP BY status 
ORDER BY status;

-- Step 4: Check for any invalid status values
SELECT 'INVALID STATUS VALUES (if any):' as info;
SELECT status, COUNT(*) as count 
FROM submissions 
WHERE status NOT IN (
    'DRAFT', 
    'SUBMITTED_TO_STATE', 
    'SUBMITTED_TO_MOSPI_REVIEWER', 
    'SUBMITTED_TO_MOSPI_APPROVER', 
    'REJECTED_TO_STATE', 
    'REJECTED_FINAL', 
    'APPROVED'
)
GROUP BY status;

-- Step 5: Final verification - should return 0 rows
SELECT 'FINAL CHECK - Should be 0:' as info;
SELECT COUNT(*) as remaining_invalid_status 
FROM submissions 
WHERE status NOT IN (
    'DRAFT', 
    'SUBMITTED_TO_STATE', 
    'SUBMITTED_TO_MOSPI_REVIEWER', 
    'SUBMITTED_TO_MOSPI_APPROVER', 
    'REJECTED_TO_STATE', 
    'REJECTED_FINAL', 
    'APPROVED'
);

-- Step 6: Show total submissions count
SELECT 'TOTAL SUBMISSIONS:' as info;
SELECT COUNT(*) as total_submissions FROM submissions;
