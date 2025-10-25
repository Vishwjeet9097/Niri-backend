-- =====================================================
-- NIRI Backend - Update Migrations Script
-- =====================================================
-- This script updates the migrations table to reflect
-- all indicator-related changes
-- Date: 2025-01-23
-- =====================================================

-- Create migrations table if it doesn't exist
CREATE TABLE IF NOT EXISTS "migrations" (
    "id" SERIAL PRIMARY KEY,
    "timestamp" BIGINT NOT NULL UNIQUE,
    "name" VARCHAR(255) NOT NULL
);

-- Insert all migration records
INSERT INTO "migrations" ("timestamp", "name") VALUES
-- Core migrations
(1700000000000, 'CreateUsersTable1700000000000'),
(1700000000001, 'CreateSubmissionsTable1700000000001'),
(1700000000002, 'CreateAuditLogsTable1700000000002'),
(1700000000003, 'CreateFinalScoresTable1700000000003'),
(1700000000004, 'SeedAdminUser1700000000004'),

-- Indicator-related migrations
(1760437774176, 'AddIndicatorTables1760437774176'),
(1760437775000, 'CreateIndicatorTables1760437775000')

ON CONFLICT (timestamp) DO UPDATE SET
    "name" = EXCLUDED."name";

-- Verify migrations
SELECT 'Migrations Updated Successfully!' as status;
SELECT COUNT(*) as "Total Migrations" FROM "migrations";
