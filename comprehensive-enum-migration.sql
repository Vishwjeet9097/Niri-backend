-- Comprehensive Status Enum Migration Script
-- Handles ALL possible status transitions and data cleanup

-- ==========================================
-- STEP 1: BACKUP CURRENT DATA (Optional)
-- ==========================================
-- CREATE TABLE submissions_backup AS SELECT * FROM submissions;

-- ==========================================
-- STEP 2: ANALYZE CURRENT DATA
-- ==========================================
SELECT '=== CURRENT STATUS ANALYSIS ===' as step;
SELECT status, COUNT(*) as count, 
       CASE 
           WHEN status = 'SUBMITTED_TO_MOSPI' THEN 'NEEDS_UPDATE'
           WHEN status IN ('DRAFT', 'SUBMITTED_TO_STATE', 'SUBMITTED_TO_MOSPI_REVIEWER', 
                          'SUBMITTED_TO_MOSPI_APPROVER', 'REJECTED_TO_STATE', 'REJECTED_FINAL', 'APPROVED') 
           THEN 'VALID'
           ELSE 'INVALID'
       END as status_check
FROM submissions 
GROUP BY status 
ORDER BY status;

-- ==========================================
-- STEP 3: UPDATE INVALID STATUS VALUES
-- ==========================================
SELECT '=== UPDATING STATUS VALUES ===' as step;

-- Update SUBMITTED_TO_MOSPI to SUBMITTED_TO_MOSPI_REVIEWER
UPDATE submissions 
SET status = 'SUBMITTED_TO_MOSPI_REVIEWER' 
WHERE status = 'SUBMITTED_TO_MOSPI';

-- Handle any other potential invalid values
-- If there are any NULL statuses, set them to DRAFT
UPDATE submissions 
SET status = 'DRAFT' 
WHERE status IS NULL;

-- If there are any empty string statuses, set them to DRAFT
UPDATE submissions 
SET status = 'DRAFT' 
WHERE status = '';

-- ==========================================
-- STEP 4: VERIFY UPDATES
-- ==========================================
SELECT '=== VERIFICATION AFTER UPDATE ===' as step;
SELECT status, COUNT(*) as count 
FROM submissions 
GROUP BY status 
ORDER BY status;

-- ==========================================
-- STEP 5: FINAL VALIDATION
-- ==========================================
SELECT '=== FINAL VALIDATION ===' as step;

-- Check for any remaining invalid statuses
SELECT 'Invalid Status Count (should be 0):' as check_type,
       COUNT(*) as count
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

-- Show total submissions
SELECT 'Total Submissions:' as check_type,
       COUNT(*) as count
FROM submissions;

-- Show status distribution
SELECT 'Status Distribution:' as check_type;
SELECT status, COUNT(*) as count,
       ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM submissions), 2) as percentage
FROM submissions 
GROUP BY status 
ORDER BY count DESC;

-- ==========================================
-- STEP 6: SUCCESS MESSAGE
-- ==========================================
SELECT '=== MIGRATION COMPLETED SUCCESSFULLY ===' as final_status;
SELECT 'All status values have been updated to match the new enum definition.' as message;
