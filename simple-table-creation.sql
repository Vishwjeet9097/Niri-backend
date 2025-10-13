-- ==========================================
-- NIRI Database Simple Table Creation Script
-- सिर्फ tables create करने के लिए (बिना data के)
-- ==========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist
DROP TABLE IF EXISTS final_scores CASCADE;
DROP TABLE IF EXISTS submissions CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop existing enums if they exist
DROP TYPE IF EXISTS submission_status CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

-- Create Enums
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

-- Create Users Table
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

-- Create Submissions Table
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

-- Create Final Scores Table
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

-- Create Audit Logs Table
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

-- Create Indexes
CREATE INDEX IDX_users_email ON users(email);
CREATE INDEX IDX_users_state_ut_role ON users("stateUt", role);
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

-- Success message
SELECT 'All tables created successfully!' as message;
