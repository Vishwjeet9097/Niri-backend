-- ==========================================
-- NIRI Database Complete Backup
-- Database: niri_db
-- Backup Date: 2025-10-13
-- ==========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- DROP EXISTING TABLES (if they exist)
-- ==========================================
DROP TABLE IF EXISTS final_scores CASCADE;
DROP TABLE IF EXISTS submissions CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS migrations CASCADE;

-- Drop existing enums if they exist
DROP TYPE IF EXISTS submission_status CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

-- ==========================================
-- CREATE ENUMS
-- ==========================================
CREATE TYPE user_role AS ENUM (
    'NODAL_OFFICER',
    'STATE_APPROVER', 
    'MOSPI_REVIEWER',
    'MOSPI_APPROVER'
);

CREATE TYPE submission_status AS ENUM (
    'DRAFT',
    'SUBMITTED_TO_STATE',
    'SUBMITTED_TO_MOSPI_REVIEWER',
    'SUBMITTED_TO_MOSPI_APPROVER',
    'REJECTED',
    'REJECTED_FINAL',
    'RETURNED_FROM_STATE',
    'RETURNED_FROM_MOSPI',
    'APPROVED'
);

-- ==========================================
-- CREATE TABLES
-- ==========================================

-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    "firstName" VARCHAR(255) NOT NULL,
    "lastName" VARCHAR(255) NOT NULL,
    "contact_number" VARCHAR(20),
    role user_role NOT NULL,
    "state_ut" VARCHAR(100) NOT NULL,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Submissions Table
CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "submissionId" VARCHAR(255) UNIQUE NOT NULL,
    "stateUt" VARCHAR(100) NOT NULL,
    "submittedBy" UUID NOT NULL,
    "rejectionCount" INTEGER DEFAULT 0,
    "formData" JSONB NOT NULL,
    "reviewComments" JSONB DEFAULT '[]'::jsonb,
    "attachedFiles" JSONB DEFAULT '[]'::jsonb,
    status submission_status DEFAULT 'SUBMITTED_TO_STATE',
    "currentOwnerRole" user_role DEFAULT 'STATE_APPROVER',
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY ("submittedBy") REFERENCES users(id) ON DELETE CASCADE
);

-- Final Scores Table
CREATE TABLE final_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "submissionId" UUID UNIQUE NOT NULL,
    "stateUt" VARCHAR(100) NOT NULL,
    "totalScore" DECIMAL(10,2) NOT NULL,
    "scoreBreakdown" JSONB NOT NULL,
    "calculationMethodology" TEXT NOT NULL,
    "approvedBy" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY ("submissionId") REFERENCES submissions(id) ON DELETE CASCADE
);

-- Audit Logs Table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "entityType" VARCHAR(100) NOT NULL,
    "entityId" VARCHAR(255) NOT NULL,
    "userId" VARCHAR(255) NOT NULL,
    "userRole" user_role NOT NULL,
    action VARCHAR(100) NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- CREATE INDEXES
-- ==========================================
CREATE INDEX IDX_users_email ON users(email);
CREATE INDEX IDX_users_state_ut_role ON users("state_ut", role);
CREATE INDEX IDX_submissions_state_ut ON submissions("stateUt");
CREATE INDEX IDX_submissions_status ON submissions(status);
CREATE INDEX IDX_submissions_submitted_by ON submissions("submittedBy");
CREATE INDEX IDX_submissions_current_owner_role ON submissions("currentOwnerRole");
CREATE INDEX IDX_submissions_attached_files ON submissions USING GIN("attachedFiles");
CREATE INDEX IDX_final_scores_state_ut ON final_scores("stateUt");
CREATE INDEX IDX_final_scores_total_score ON final_scores("totalScore");
CREATE INDEX IDX_final_scores_created_at ON final_scores("createdAt");
CREATE INDEX IDX_audit_logs_entity ON audit_logs("entityType", "entityId");
CREATE INDEX IDX_audit_logs_user_id ON audit_logs("userId");
CREATE INDEX IDX_audit_logs_action ON audit_logs(action);
CREATE INDEX IDX_audit_logs_created_at ON audit_logs("createdAt");

-- ==========================================
-- INSERT DATA
-- ==========================================

-- Users Data
INSERT INTO users (id, email, password, "firstName", "lastName", "contact_number", role, "state_ut", "isActive", "createdAt", "updatedAt") VALUES
('11111111-1111-1111-1111-111111111111', 'nodal@niri.gov.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K', 'Nodal', 'Officer', NULL, 'NODAL_OFFICER', 'Maharashtra', true, '2025-10-12T16:46:10.705Z', '2025-10-12T16:46:10.705Z'),
('22222222-2222-2222-2222-222222222222', 'state@niri.gov.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K', 'State', 'Approver', NULL, 'STATE_APPROVER', 'Maharashtra', true, '2025-10-12T16:46:10.705Z', '2025-10-12T16:46:10.705Z'),
('33333333-3333-3333-3333-333333333333', 'mospi.reviewer@niri.gov.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K', 'MoSPI', 'Reviewer', NULL, 'MOSPI_REVIEWER', 'Central', true, '2025-10-12T16:46:10.705Z', '2025-10-12T16:46:10.705Z'),
('44444444-4444-4444-4444-444444444444', 'mospi.approver@niri.gov.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K', 'MoSPI', 'Approver', NULL, 'MOSPI_APPROVER', 'Central', true, '2025-10-12T16:46:10.705Z', '2025-10-12T16:46:10.705Z');

-- ==========================================
-- VERIFICATION
-- ==========================================
SELECT 'Database Backup Completed Successfully!' as status;
SELECT 'Tables Created:' as info;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

SELECT 'Record Counts:' as info;
SELECT 'Users:' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'Submissions:' as table_name, COUNT(*) as count FROM submissions
UNION ALL
SELECT 'Final Scores:' as table_name, COUNT(*) as count FROM final_scores
UNION ALL
SELECT 'Audit Logs:' as table_name, COUNT(*) as count FROM audit_logs;

-- ==========================================
-- BACKUP SUMMARY
-- ==========================================
SELECT '=== NIRI DATABASE BACKUP SUMMARY ===' as title;
SELECT 'Backup Date: 2025-10-13' as backup_date;
SELECT 'Database: niri_db' as database_name;
SELECT 'Users: 4' as user_count;
SELECT 'Submissions: 0' as submission_count;
SELECT 'Final Scores: 0' as score_count;
SELECT 'Audit Logs: 0' as audit_count;
SELECT 'Status: Complete' as status;
