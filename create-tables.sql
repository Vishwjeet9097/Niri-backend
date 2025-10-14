-- NIRI Database Tables Creation Script
-- यह script सभी tables create करने के लिए है

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    "firstName" VARCHAR(255) NOT NULL,
    "lastName" VARCHAR(255) NOT NULL,
    "contactNumber" VARCHAR(20),
    role VARCHAR(50) NOT NULL CHECK (role IN ('NODAL_OFFICER', 'STATE_APPROVER', 'MOSPI_REVIEWER', 'MOSPI_APPROVER')),
    "stateUt" VARCHAR(100) NOT NULL,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_state_role ON users("stateUt", role);

-- 2. Submissions Table
CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "submissionId" VARCHAR(255) UNIQUE NOT NULL,
    "stateUt" VARCHAR(100) NOT NULL,
    "submittedBy" UUID NOT NULL,
    "rejectionCount" INTEGER DEFAULT 0,
    "formData" JSONB NOT NULL,
    "reviewComments" JSONB DEFAULT '[]'::jsonb,
    "attachedFiles" JSONB[] DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'SUBMITTED_TO_STATE' CHECK (status IN (
        'DRAFT', 'SUBMITTED_TO_STATE', 'SUBMITTED_TO_MOSPI_REVIEWER', 
        'SUBMITTED_TO_MOSPI_APPROVER', 'REJECTED', 'REJECTED_FINAL', 
        'RETURNED_FROM_STATE', 'RETURNED_FROM_MOSPI', 'APPROVED'
    )),
    "currentOwnerRole" VARCHAR(50) DEFAULT 'STATE_APPROVER' CHECK ("currentOwnerRole" IN (
        'NODAL_OFFICER', 'STATE_APPROVER', 'MOSPI_REVIEWER', 'MOSPI_APPROVER'
    )),
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("submittedBy") REFERENCES users(id)
);

-- Submissions table indexes
CREATE INDEX IF NOT EXISTS idx_submissions_state ON submissions("stateUt");
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_by ON submissions("submittedBy");
CREATE INDEX IF NOT EXISTS idx_submissions_owner_role ON submissions("currentOwnerRole");

-- 3. Final Scores Table
CREATE TABLE IF NOT EXISTS final_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "submissionId" UUID UNIQUE NOT NULL,
    "stateUt" VARCHAR(100) NOT NULL,
    "totalScore" DECIMAL(10,2) NOT NULL,
    "scoreBreakdown" JSONB NOT NULL,
    "calculationMethodology" TEXT NOT NULL,
    "approvedBy" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("submissionId") REFERENCES submissions(id)
);

-- Final scores table indexes
CREATE INDEX IF NOT EXISTS idx_final_scores_state ON final_scores("stateUt");
CREATE INDEX IF NOT EXISTS idx_final_scores_total_score ON final_scores("totalScore");
CREATE INDEX IF NOT EXISTS idx_final_scores_created_at ON final_scores("createdAt");

-- 4. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "entityType" VARCHAR(100) NOT NULL,
    "entityId" VARCHAR(255) NOT NULL,
    "userId" VARCHAR(255) NOT NULL,
    "userRole" VARCHAR(50) NOT NULL CHECK ("userRole" IN (
        'NODAL_OFFICER', 'STATE_APPROVER', 'MOSPI_REVIEWER', 'MOSPI_APPROVER'
    )),
    action VARCHAR(100) NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit logs table indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs("entityType", "entityId");
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs("userId");
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs("createdAt");

-- Success message
SELECT 'All tables created successfully!' as message;
