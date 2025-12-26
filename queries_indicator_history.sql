-- =====================================================
-- NIRI Backend - Queries for Indicator Score History
-- =====================================================
-- This file contains SQL queries to view indicator score history
-- Date: 2025-01-XX
-- =====================================================

-- =====================================================
-- Query 1: Get Latest Entry for a Specific Indicator Code
-- =====================================================
-- Replace '1.1' with the indicator code you want to check
-- Example: '1.1', '1.2', '2.3', '3.4', '4.1', etc.
SELECT 
    id,
    "submissionId",
    "indicatorCode",
    category,
    score,
    "maxScore",
    "previousScore",
    "scoreChange",
    calculation,
    "updateReason",
    "indicatorStatus",
    "updatedBy",
    "createdAt"
FROM "indicator_score_history"
WHERE "indicatorCode" = '1.1'  -- Replace with your indicator code
ORDER BY "createdAt" DESC
LIMIT 1;

-- =====================================================
-- Query 2: Get Latest Entry for a Specific Indicator Code 
--         with Submission Details (JOIN with submissions table)
-- =====================================================
-- This query also shows the submission_id string for easier reference
SELECT 
    h.id,
    h."submissionId",
    s."submission_id" as submission_id_string,
    s."stateUt",
    h."indicatorCode",
    h.category,
    h.score,
    h."maxScore",
    h."previousScore",
    h."scoreChange",
    h.calculation,
    h."updateReason",
    h."indicatorStatus",
    h."updatedBy",
    h."createdAt"
FROM "indicator_score_history" h
JOIN submissions s ON h."submissionId" = s.id
WHERE h."indicatorCode" = '1.1'  -- Replace with your indicator code
ORDER BY h."createdAt" DESC
LIMIT 1;

-- =====================================================
-- Query 3: Get Latest Entry for a Specific Indicator Code 
--         for a Specific Submission
-- =====================================================
-- Replace '1.1' with indicator code and 'SUB-2025-XXXXXX' with submission_id
SELECT 
    h.id,
    h."submissionId",
    s."submission_id" as submission_id_string,
    s."stateUt",
    h."indicatorCode",
    h.category,
    h.score,
    h."maxScore",
    h."previousScore",
    h."scoreChange",
    h.calculation,
    h."updateReason",
    h."indicatorStatus",
    h."updatedBy",
    h."createdAt"
FROM "indicator_score_history" h
JOIN submissions s ON h."submissionId" = s.id
WHERE h."indicatorCode" = '1.1'  -- Replace with your indicator code
  AND s."submission_id" = 'SUB-2025-XXXXXX'  -- Replace with your submission_id
ORDER BY h."createdAt" DESC
LIMIT 1;

-- =====================================================
-- Query 4: Get All Latest Entries for Each Indicator Code
-- =====================================================
-- This shows the most recent entry for each indicator code
SELECT DISTINCT ON ("indicatorCode")
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
    "createdAt"
FROM "indicator_score_history"
ORDER BY "indicatorCode", "createdAt" DESC;

-- =====================================================
-- Query 5: Get Latest 10 Entries for a Specific Indicator Code
-- =====================================================
-- Useful to see recent history/trends for an indicator
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
    "createdAt"
FROM "indicator_score_history"
WHERE "indicatorCode" = '1.1'  -- Replace with your indicator code
ORDER BY "createdAt" DESC
LIMIT 10;

-- =====================================================
-- Query 6: Get Latest Entry for Each Indicator Code 
--         for a Specific Submission
-- =====================================================
-- Shows the latest score for each indicator in a submission
SELECT DISTINCT ON (h."indicatorCode")
    h.id,
    h."submissionId",
    s."submission_id" as submission_id_string,
    s."stateUt",
    h."indicatorCode",
    h.category,
    h.score,
    h."maxScore",
    h."previousScore",
    h."scoreChange",
    h."updateReason",
    h."indicatorStatus",
    h."createdAt"
FROM "indicator_score_history" h
JOIN submissions s ON h."submissionId" = s.id
WHERE s."submission_id" = 'SUB-2025-XXXXXX'  -- Replace with your submission_id
ORDER BY h."indicatorCode", h."createdAt" DESC;

-- =====================================================
-- Query 7: Get Latest Entry with Full Details (including formDataSnapshot)
-- =====================================================
-- This includes the formDataSnapshot which shows the form data at that point
SELECT 
    id,
    "submissionId",
    "indicatorCode",
    category,
    score,
    "maxScore",
    "previousScore",
    "scoreChange",
    calculation,
    "formDataSnapshot",
    "updateReason",
    "indicatorStatus",
    "updatedBy",
    "createdAt"
FROM "indicator_score_history"
WHERE "indicatorCode" = '1.1'  -- Replace with your indicator code
ORDER BY "createdAt" DESC
LIMIT 1;

-- =====================================================
-- Query 8: Count Total History Entries for an Indicator Code
-- =====================================================
SELECT 
    "indicatorCode",
    COUNT(*) as total_history_entries,
    MIN("createdAt") as first_entry,
    MAX("createdAt") as latest_entry
FROM "indicator_score_history"
WHERE "indicatorCode" = '1.1'  -- Replace with your indicator code
GROUP BY "indicatorCode";

-- =====================================================
-- Query 9: Get Latest Entry with Score Change Analysis
-- =====================================================
-- Shows if score increased, decreased, or stayed the same
SELECT 
    id,
    "submissionId",
    "indicatorCode",
    category,
    score,
    "previousScore",
    "scoreChange",
    CASE 
        WHEN "scoreChange" > 0 THEN 'INCREASED'
        WHEN "scoreChange" < 0 THEN 'DECREASED'
        WHEN "scoreChange" = 0 THEN 'NO CHANGE'
        ELSE 'N/A'
    END as change_type,
    "updateReason",
    "indicatorStatus",
    "createdAt"
FROM "indicator_score_history"
WHERE "indicatorCode" = '1.1'  -- Replace with your indicator code
ORDER BY "createdAt" DESC
LIMIT 1;

-- =====================================================
-- Query 10: Get Latest Entry for All 19 Indicators
-- =====================================================
-- Shows the most recent entry for each of the 19 indicators
SELECT DISTINCT ON ("indicatorCode")
    "indicatorCode",
    category,
    score,
    "maxScore",
    "previousScore",
    "scoreChange",
    "updateReason",
    "indicatorStatus",
    "createdAt"
FROM "indicator_score_history"
ORDER BY "indicatorCode", "createdAt" DESC;

