-- Manual Database Enum Fix Script
-- Run this in psql to fix the enum issue
-- IMPORTANT: Run each step separately in different transactions!

-- ==========================================
-- STEP 1: Check current enum values
-- ==========================================
SELECT 'Current Enum Values:' as info;
SELECT enumlabel as enum_value 
FROM pg_enum 
WHERE enumtypid = (
    SELECT oid 
    FROM pg_type 
    WHERE typname = 'submissions_status_enum'
)
ORDER BY enumlabel;

-- ==========================================
-- STEP 2: Add first enum value (COMMIT after this)
-- ==========================================
ALTER TYPE submissions_status_enum ADD VALUE 'SUBMITTED_TO_MOSPI_REVIEWER';
COMMIT;

-- ==========================================
-- STEP 3: Add second enum value (COMMIT after this)
-- ==========================================
ALTER TYPE submissions_status_enum ADD VALUE 'SUBMITTED_TO_MOSPI_APPROVER';
COMMIT;

-- ==========================================
-- STEP 4: Verify new enum values
-- ==========================================
SELECT 'Updated Enum Values:' as info;
SELECT enumlabel as enum_value 
FROM pg_enum 
WHERE enumtypid = (
    SELECT oid 
    FROM pg_type 
    WHERE typname = 'submissions_status_enum'
)
ORDER BY enumlabel;

-- ==========================================
-- STEP 5: Now update the data
-- ==========================================
UPDATE submissions 
SET status = 'SUBMITTED_TO_MOSPI_REVIEWER' 
WHERE status = 'SUBMITTED_TO_MOSPI';

-- ==========================================
-- STEP 6: Verify the update
-- ==========================================
SELECT 'Final Status Distribution:' as info;
SELECT status, COUNT(*) as count 
FROM submissions 
GROUP BY status 
ORDER BY status;

-- ==========================================
-- STEP 7: Clean up old enum (optional)
-- ==========================================
-- DROP TYPE submissions_status_enum_old;
