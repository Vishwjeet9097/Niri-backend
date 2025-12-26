-- =====================================================
-- NIRI - Submission Score Queries
-- =====================================================
-- This file contains useful queries for viewing and managing
-- submission scores and history
-- =====================================================

-- =====================================================
-- 1. VIEW SUBMISSION DETAILS
-- =====================================================
-- Replace 'YOUR_SUBMISSION_ID' with actual submission ID (UUID)
-- Example: 'eef798d6-a79a-4425-a372-e91fb1ee0edc'

-- View submission basic info
SELECT 
    id,
    submission_id,
    state_ut,
    submitted_by,
    status,
    current_owner_role,
    created_at,
    updated_at
FROM submissions
WHERE id = 'YOUR_SUBMISSION_ID';

-- View full submission with form data
SELECT 
    id,
    submission_id,
    state_ut,
    submitted_by,
    status,
    current_owner_role,
    form_data,
    created_at,
    updated_at
FROM submissions
WHERE id = 'YOUR_SUBMISSION_ID';

-- View submission with user details
SELECT 
    s.id,
    s.submission_id,
    s.state_ut,
    s.status,
    s.current_owner_role,
    u.email,
    u.first_name,
    u.last_name,
    u.role,
    s.created_at,
    s.updated_at
FROM submissions s
LEFT JOIN users u ON s.submitted_by = u.id
WHERE s.id = 'YOUR_SUBMISSION_ID';

-- =====================================================
-- 2. VIEW INDICATOR SCORES FOR A SUBMISSION
-- =====================================================
-- Replace 'YOUR_SUBMISSION_ID' with actual submission ID (UUID)

-- View all indicator scores for a submission
SELECT 
    id,
    "submissionId",
    "indicatorCode",
    category,
    score,
    "maxScore",
    ROUND((score / "maxScore" * 100)::numeric, 2) as percentage,
    calculation,
    created_at,
    updated_at
FROM indicator_scores
WHERE "submissionId" = 'YOUR_SUBMISSION_ID'
ORDER BY "indicatorCode" ASC;

-- View indicator scores with summary
SELECT 
    "indicatorCode",
    category,
    score,
    "maxScore",
    ROUND((score / "maxScore" * 100)::numeric, 2) as percentage,
    calculation->>'indicator' as indicator_name,
    calculation->>'value' as calculated_value,
    updated_at
FROM indicator_scores
WHERE "submissionId" = 'YOUR_SUBMISSION_ID'
ORDER BY "indicatorCode" ASC;

-- Summary of scores by category
SELECT 
    category,
    COUNT(*) as indicator_count,
    SUM(score) as total_score,
    SUM("maxScore") as total_max_score,
    ROUND((SUM(score) / SUM("maxScore") * 100)::numeric, 2) as category_percentage
FROM indicator_scores
WHERE "submissionId" = 'YOUR_SUBMISSION_ID'
GROUP BY category
ORDER BY category;

-- Overall summary
SELECT 
    COUNT(*) as total_indicators,
    SUM(score) as total_score,
    SUM("maxScore") as total_max_score,
    ROUND((SUM(score) / SUM("maxScore") * 100)::numeric, 2) as overall_percentage,
    MIN(updated_at) as first_score_date,
    MAX(updated_at) as last_score_date
FROM indicator_scores
WHERE "submissionId" = 'YOUR_SUBMISSION_ID';

-- =====================================================
-- 3. VIEW INDICATOR SCORE HISTORY FOR A SUBMISSION
-- =====================================================
-- Replace 'YOUR_SUBMISSION_ID' with actual submission ID (UUID)

-- View all history records for a submission
SELECT 
    id,
    "submissionId",
    "indicatorCode",
    category,
    score,
    "maxScore",
    "previousScore",
    "scoreChange",
    "updateReason",
    "indicatorStatus",
    "updatedBy",
    created_at
FROM indicator_score_history
WHERE "submissionId" = 'YOUR_SUBMISSION_ID'
ORDER BY created_at DESC, "indicatorCode" ASC;

-- View history with score changes
SELECT 
    "indicatorCode",
    category,
    "previousScore",
    score as current_score,
    "scoreChange",
    "updateReason",
    "indicatorStatus",
    created_at,
    CASE 
        WHEN "scoreChange" > 0 THEN '↑ Increased'
        WHEN "scoreChange" < 0 THEN '↓ Decreased'
        WHEN "scoreChange" = 0 THEN '→ No Change'
        ELSE 'New Score'
    END as change_direction
FROM indicator_score_history
WHERE "submissionId" = 'YOUR_SUBMISSION_ID'
ORDER BY created_at DESC, "indicatorCode" ASC;

-- History grouped by indicator
SELECT 
    "indicatorCode",
    category,
    COUNT(*) as update_count,
    MIN(score) as min_score,
    MAX(score) as max_score,
    AVG(score) as avg_score,
    MIN(created_at) as first_update,
    MAX(created_at) as last_update
FROM indicator_score_history
WHERE "submissionId" = 'YOUR_SUBMISSION_ID'
GROUP BY "indicatorCode", category
ORDER BY "indicatorCode" ASC;

-- Timeline of all score changes
SELECT 
    created_at,
    "indicatorCode",
    category,
    "previousScore",
    score as new_score,
    "scoreChange",
    "updateReason",
    "indicatorStatus",
    "updatedBy"
FROM indicator_score_history
WHERE "submissionId" = 'YOUR_SUBMISSION_ID'
ORDER BY created_at DESC;

-- =====================================================
-- 4. VIEW SPECIFIC INDICATOR SCORE AND HISTORY
-- =====================================================
-- Replace 'YOUR_SUBMISSION_ID' and 'INDICATOR_CODE' (e.g., '1.1', '2.3')

-- Current score for a specific indicator
SELECT 
    id,
    "submissionId",
    "indicatorCode",
    category,
    score,
    "maxScore",
    calculation,
    updated_at
FROM indicator_scores
WHERE "submissionId" = 'YOUR_SUBMISSION_ID'
AND "indicatorCode" = 'INDICATOR_CODE';

-- History for a specific indicator
SELECT 
    id,
    "submissionId",
    "indicatorCode",
    category,
    "previousScore",
    score,
    "scoreChange",
    "updateReason",
    "indicatorStatus",
    "updatedBy",
    created_at
FROM indicator_score_history
WHERE "submissionId" = 'YOUR_SUBMISSION_ID'
AND "indicatorCode" = 'INDICATOR_CODE'
ORDER BY created_at DESC;

-- =====================================================
-- 5. COMPLETE VIEW - SUBMISSION WITH ALL SCORES
-- =====================================================
-- Replace 'YOUR_SUBMISSION_ID' with actual submission ID (UUID)

SELECT 
    s.id as submission_id,
    s.submission_id as submission_code,
    s.state_ut,
    s.status,
    s.current_owner_role,
    COUNT(DISTINCT isc.id) as indicator_count,
    COALESCE(SUM(isc.score), 0) as total_score,
    COALESCE(SUM(isc."maxScore"), 0) as total_max_score,
    ROUND((COALESCE(SUM(isc.score), 0) / NULLIF(SUM(isc."maxScore"), 0) * 100)::numeric, 2) as overall_percentage,
    COUNT(DISTINCT ish.id) as total_history_records,
    MIN(isc.created_at) as first_score_date,
    MAX(isc.updated_at) as last_score_date
FROM submissions s
LEFT JOIN indicator_scores isc ON s.id = isc."submissionId"
LEFT JOIN indicator_score_history ish ON s.id = ish."submissionId"
WHERE s.id = 'YOUR_SUBMISSION_ID'
GROUP BY s.id, s.submission_id, s.state_ut, s.status, s.current_owner_role;

-- =====================================================
-- 6. DELETE QUERIES
-- =====================================================
-- WARNING: These queries will permanently delete data!
-- Use with caution and always backup first!
-- Replace 'YOUR_SUBMISSION_ID' with actual submission ID (UUID)

-- Option 1: Delete using CASCADE (if foreign keys are set up)
-- This will automatically delete related indicator_scores and indicator_score_history records
DELETE FROM submissions
WHERE id = 'YOUR_SUBMISSION_ID';

-- Option 2: Manual deletion (if foreign keys are not set up)
-- Step 1: Delete indicator score history first
DELETE FROM indicator_score_history
WHERE "submissionId" = 'YOUR_SUBMISSION_ID';

-- Step 2: Delete indicator scores
DELETE FROM indicator_scores
WHERE "submissionId" = 'YOUR_SUBMISSION_ID';

-- Step 3: Delete final score (if exists)
DELETE FROM final_scores
WHERE "submissionId" = 'YOUR_SUBMISSION_ID';

-- Step 4: Delete submission
DELETE FROM submissions
WHERE id = 'YOUR_SUBMISSION_ID';

-- Option 3: Safe deletion with verification
-- First, check what will be deleted
SELECT 
    'submissions' as table_name,
    COUNT(*) as record_count
FROM submissions
WHERE id = 'YOUR_SUBMISSION_ID'
UNION ALL
SELECT 
    'indicator_scores' as table_name,
    COUNT(*) as record_count
FROM indicator_scores
WHERE "submissionId" = 'YOUR_SUBMISSION_ID'
UNION ALL
SELECT 
    'indicator_score_history' as table_name,
    COUNT(*) as record_count
FROM indicator_score_history
WHERE "submissionId" = 'YOUR_SUBMISSION_ID'
UNION ALL
SELECT 
    'final_scores' as table_name,
    COUNT(*) as record_count
FROM final_scores
WHERE "submissionId" = 'YOUR_SUBMISSION_ID';

-- Then delete (use transaction for safety)
BEGIN;

-- Delete in order (history -> scores -> final_score -> submission)
DELETE FROM indicator_score_history WHERE "submissionId" = 'YOUR_SUBMISSION_ID';
DELETE FROM indicator_scores WHERE "submissionId" = 'YOUR_SUBMISSION_ID';
DELETE FROM final_scores WHERE "submissionId" = 'YOUR_SUBMISSION_ID';
DELETE FROM submissions WHERE id = 'YOUR_SUBMISSION_ID';

-- Verify deletion
SELECT 
    'submissions' as table_name,
    COUNT(*) as remaining_records
FROM submissions
WHERE id = 'YOUR_SUBMISSION_ID'
UNION ALL
SELECT 
    'indicator_scores' as table_name,
    COUNT(*) as remaining_records
FROM indicator_scores
WHERE "submissionId" = 'YOUR_SUBMISSION_ID'
UNION ALL
SELECT 
    'indicator_score_history' as table_name,
    COUNT(*) as remaining_records
FROM indicator_score_history
WHERE "submissionId" = 'YOUR_SUBMISSION_ID';

-- If everything looks good, commit; otherwise rollback
COMMIT;
-- ROLLBACK; -- Use this if something went wrong

-- =====================================================
-- 7. USEFUL HELPER QUERIES
-- =====================================================

-- Find submissions with scores
SELECT 
    s.id,
    s.submission_id,
    s.state_ut,
    s.status,
    COUNT(isc.id) as indicator_count,
    SUM(isc.score) as total_score
FROM submissions s
INNER JOIN indicator_scores isc ON s.id = isc."submissionId"
GROUP BY s.id, s.submission_id, s.state_ut, s.status
ORDER BY s.created_at DESC;

-- Find submissions without scores
SELECT 
    s.id,
    s.submission_id,
    s.state_ut,
    s.status,
    s.created_at
FROM submissions s
LEFT JOIN indicator_scores isc ON s.id = isc."submissionId"
WHERE isc.id IS NULL
ORDER BY s.created_at DESC;

-- Count score history records per submission
SELECT 
    s.submission_id,
    s.state_ut,
    COUNT(ish.id) as history_record_count
FROM submissions s
LEFT JOIN indicator_score_history ish ON s.id = ish."submissionId"
GROUP BY s.id, s.submission_id, s.state_ut
ORDER BY history_record_count DESC;

-- =====================================================
-- END OF QUERIES
-- =====================================================

