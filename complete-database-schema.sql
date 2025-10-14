-- ==========================================
-- NIRI Database Complete Schema Recreation Script
-- यह script सभी tables को recreate करने के लिए है
-- ==========================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- STEP 1: DROP EXISTING TABLES (if they exist)
-- ==========================================
DROP TABLE IF EXISTS final_scores CASCADE;
DROP TABLE IF EXISTS submissions CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ==========================================
-- STEP 2: CREATE ENUMS
-- ==========================================

-- User Role Enum
CREATE TYPE user_role AS ENUM (
    'NODAL_OFFICER',
    'STATE_APPROVER', 
    'MOSPI_REVIEWER',
    'MOSPI_APPROVER'
);

-- Submission Status Enum
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
-- STEP 3: CREATE TABLES
-- ==========================================

-- 1. Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    "firstName" VARCHAR(255) NOT NULL,
    "lastName" VARCHAR(255) NOT NULL,
    "contactNumber" VARCHAR(20),
    role user_role NOT NULL,
    "stateUt" VARCHAR(100) NOT NULL,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Submissions Table
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
    
    -- Foreign Key Constraints
    CONSTRAINT FK_submissions_submitted_by 
        FOREIGN KEY ("submittedBy") REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Final Scores Table
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
    
    -- Foreign Key Constraints
    CONSTRAINT FK_final_scores_submission_id 
        FOREIGN KEY ("submissionId") REFERENCES submissions(id) ON DELETE CASCADE
);

-- 4. Audit Logs Table
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
-- STEP 4: CREATE INDEXES
-- ==========================================

-- Users table indexes
CREATE INDEX IDX_users_email ON users(email);
CREATE INDEX IDX_users_state_ut_role ON users("stateUt", role);

-- Submissions table indexes
CREATE INDEX IDX_submissions_state_ut ON submissions("stateUt");
CREATE INDEX IDX_submissions_status ON submissions(status);
CREATE INDEX IDX_submissions_submitted_by ON submissions("submittedBy");
CREATE INDEX IDX_submissions_current_owner_role ON submissions("currentOwnerRole");
CREATE INDEX IDX_submissions_attached_files ON submissions USING GIN("attachedFiles");

-- Final scores table indexes
CREATE INDEX IDX_final_scores_state_ut ON final_scores("stateUt");
CREATE INDEX IDX_final_scores_total_score ON final_scores("totalScore");
CREATE INDEX IDX_final_scores_created_at ON final_scores("createdAt");

-- Audit logs table indexes
CREATE INDEX IDX_audit_logs_entity ON audit_logs("entityType", "entityId");
CREATE INDEX IDX_audit_logs_user_id ON audit_logs("userId");
CREATE INDEX IDX_audit_logs_action ON audit_logs(action);
CREATE INDEX IDX_audit_logs_created_at ON audit_logs("createdAt");

-- ==========================================
-- STEP 5: INSERT DEFAULT USERS
-- ==========================================

-- Insert default users with hashed password
INSERT INTO users (id, email, password, "firstName", "lastName", role, "stateUt", "isActive", "createdAt", "updatedAt") VALUES
('11111111-1111-1111-1111-111111111111', 'nodal@niri.gov.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K', 'Nodal', 'Officer', 'NODAL_OFFICER', 'Maharashtra', true, NOW(), NOW()),
('22222222-2222-2222-2222-222222222222', 'state@niri.gov.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K', 'State', 'Approver', 'STATE_APPROVER', 'Maharashtra', true, NOW(), NOW()),
('33333333-3333-3333-3333-333333333333', 'mospi.reviewer@niri.gov.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K', 'MoSPI', 'Reviewer', 'MOSPI_REVIEWER', 'Central', true, NOW(), NOW()),
('44444444-4444-4444-4444-444444444444', 'mospi.approver@niri.gov.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K', 'MoSPI', 'Approver', 'MOSPI_APPROVER', 'Central', true, NOW(), NOW());

-- ==========================================
-- STEP 6: VERIFICATION QUERIES
-- ==========================================

-- Verify tables were created
SELECT 'Tables Created:' as verification;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'submissions', 'final_scores', 'audit_logs')
ORDER BY table_name;

-- Verify enums were created
SELECT 'Enums Created:' as verification;
SELECT typname 
FROM pg_type 
WHERE typname IN ('user_role', 'submission_status');

-- Verify indexes were created
SELECT 'Indexes Created:' as verification;
SELECT indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE 'IDX_%'
ORDER BY indexname;

-- Verify default users were inserted
SELECT 'Default Users:' as verification;
SELECT email, "firstName", "lastName", role, "stateUt" 
FROM users 
ORDER BY role;

-- Count records in each table
SELECT 'Record Counts:' as verification;
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'submissions' as table_name, COUNT(*) as count FROM submissions
UNION ALL
SELECT 'final_scores' as table_name, COUNT(*) as count FROM final_scores
UNION ALL
SELECT 'audit_logs' as table_name, COUNT(*) as count FROM audit_logs;

-- ==========================================
-- SUCCESS MESSAGE
-- ==========================================
SELECT '=== DATABASE SCHEMA RECREATED SUCCESSFULLY ===' as final_status;
SELECT 'All tables, indexes, constraints, and default data have been created.' as message;
SELECT 'You can now use the NIRI application with a fresh database.' as next_steps;
