# pgcli में Database Setup Commands

## 🚀 Step-by-Step Instructions

### 1. Tables Create करना

आपके pgcli terminal में ये commands run करें:

```sql
-- पहले tables create करें
\i create-tables.sql
```

या manually copy-paste करें:

```sql
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

-- Users indexes
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

-- Submissions indexes
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

-- Final scores indexes
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

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs("entityType", "entityId");
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs("userId");
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs("createdAt");
```

### 2. Tables Verify करना

```sql
-- सभी tables list करें
\dt

-- Table structure देखें
\d users
\d submissions
\d final_scores
\d audit_logs
```

### 3. Dummy Data Insert करना

```sql
-- Users data
INSERT INTO users (id, email, password, "firstName", "lastName", "contactNumber", role, "stateUt", "isActive") VALUES
('550e8400-e29b-41d4-a716-446655440001', 'admin@niri.gov.in', '$2b$10$rQZ8K9vL8xN5mP2qR1sT3uV4wX7yZ9aB2cD5eF8gH1jK4mN7pQ0sT3uV6wX9zA', 'System', 'Administrator', '+91-9876543210', 'MOSPI_APPROVER', 'Central', true),
('550e8400-e29b-41d4-a716-446655440002', 'maharashtra.nodal@niri.gov.in', '$2b$10$rQZ8K9vL8xN5mP2qR1sT3uV4wX7yZ9aB2cD5eF8gH1jK4mN7pQ0sT3uV6wX9zA', 'Rajesh', 'Kumar', '+91-9876543211', 'NODAL_OFFICER', 'Maharashtra', true),
('550e8400-e29b-41d4-a716-446655440003', 'karnataka.nodal@niri.gov.in', '$2b$10$rQZ8K9vL8xN5mP2qR1sT3uV4wX7yZ9aB2cD5eF8gH1jK4mN7pQ0sT3uV6wX9zA', 'Priya', 'Sharma', '+91-9876543212', 'NODAL_OFFICER', 'Karnataka', true),
('550e8400-e29b-41d4-a716-446655440004', 'maharashtra.approver@niri.gov.in', '$2b$10$rQZ8K9vL8xN5mP2qR1sT3uV4wX7yZ9aB2cD5eF8gH1jK4mN7pQ0sT3uV6wX9zA', 'Amit', 'Singh', '+91-9876543213', 'STATE_APPROVER', 'Maharashtra', true),
('550e8400-e29b-41d4-a716-446655440005', 'karnataka.approver@niri.gov.in', '$2b$10$rQZ8K9vL8xN5mP2qR1sT3uV4wX7yZ9aB2cD5eF8gH1jK4mN7pQ0sT3uV6wX9zA', 'Sneha', 'Patel', '+91-9876543214', 'STATE_APPROVER', 'Karnataka', true),
('550e8400-e29b-41d4-a716-446655440006', 'reviewer1@niri.gov.in', '$2b$10$rQZ8K9vL8xN5mP2qR1sT3uV4wX7yZ9aB2cD5eF8gH1jK4mN7pQ0sT3uV6wX9zA', 'Dr. Vikram', 'Joshi', '+91-9876543215', 'MOSPI_REVIEWER', 'Central', true),
('550e8400-e29b-41d4-a716-446655440007', 'reviewer2@niri.gov.in', '$2b$10$rQZ8K9vL8xN5mP2qR1sT3uV4wX7yZ9aB2cD5eF8gH1jK4mN7pQ0sT3uV6wX9zA', 'Dr. Anjali', 'Mehta', '+91-9876543216', 'MOSPI_REVIEWER', 'Central', true);

-- Submissions data
INSERT INTO submissions (id, "submissionId", "stateUt", "submittedBy", "formData", status, "currentOwnerRole") VALUES
('sub-001', 'MAH-2024-001', 'Maharashtra', '550e8400-e29b-41d4-a716-446655440002',
 '{"infrastructure": {"transport": 85, "water": 78, "energy": 92, "telecom": 88, "healthcare": 76, "education": 82}, "population": 120000000, "area": 307713}',
 'SUBMITTED_TO_STATE', 'STATE_APPROVER'),

('sub-002', 'KAR-2024-001', 'Karnataka', '550e8400-e29b-41d4-a716-446655440003',
 '{"infrastructure": {"transport": 88, "water": 82, "energy": 95, "telecom": 91, "healthcare": 84, "education": 89}, "population": 64000000, "area": 191791}',
 'SUBMITTED_TO_MOSPI_REVIEWER', 'MOSPI_REVIEWER'),

('sub-003', 'TAM-2024-001', 'Tamil Nadu', '550e8400-e29b-41d4-a716-446655440002',
 '{"infrastructure": {"transport": 79, "water": 85, "energy": 87, "telecom": 83, "healthcare": 88, "education": 85}, "population": 72000000, "area": 130058}',
 'DRAFT', 'NODAL_OFFICER'),

('sub-004', 'GUJ-2024-001', 'Gujarat', '550e8400-e29b-41d4-a716-446655440002',
 '{"infrastructure": {"transport": 82, "water": 79, "energy": 89, "telecom": 86, "healthcare": 81, "education": 87}, "population": 60000000, "area": 196024}',
 'APPROVED', 'MOSPI_APPROVER'),

('sub-005', 'DEL-2024-001', 'Delhi', '550e8400-e29b-41d4-a716-446655440002',
 '{"infrastructure": {"transport": 91, "water": 74, "energy": 93, "telecom": 94, "healthcare": 89, "education": 91}, "population": 20000000, "area": 1484}',
 'SUBMITTED_TO_MOSPI_APPROVER', 'MOSPI_APPROVER');

-- Final scores data
INSERT INTO final_scores (id, "submissionId", "stateUt", "totalScore", "scoreBreakdown", "calculationMethodology", "approvedBy") VALUES
('score-001', 'sub-002', 'Karnataka', 87.5,
 '{"transport": 88, "water": 82, "energy": 95, "telecom": 91, "healthcare": 84, "education": 89, "weighted_average": 87.5}',
 'Weighted average calculation based on infrastructure categories with energy and telecom having higher weights',
 '550e8400-e29b-41d4-a716-446655440001'),

('score-002', 'sub-004', 'Gujarat', 84.0,
 '{"transport": 82, "water": 79, "energy": 89, "telecom": 86, "healthcare": 81, "education": 87, "weighted_average": 84.0}',
 'Standard weighted average with equal weights for all infrastructure categories',
 '550e8400-e29b-41d4-a716-446655440001');

-- Audit logs data
INSERT INTO audit_logs (id, "entityType", "entityId", "userId", "userRole", action, "oldValues", "newValues", "ipAddress", "userAgent") VALUES
('audit-001', 'submission', 'sub-001', '550e8400-e29b-41d4-a716-446655440002', 'NODAL_OFFICER', 'CREATE', NULL, '{"status": "DRAFT"}', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'),
('audit-002', 'submission', 'sub-001', '550e8400-e29b-41d4-a716-446655440002', 'NODAL_OFFICER', 'UPDATE', '{"status": "DRAFT"}', '{"status": "SUBMITTED_TO_STATE"}', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'),
('audit-003', 'submission', 'sub-002', '550e8400-e29b-41d4-a716-446655440003', 'NODAL_OFFICER', 'CREATE', NULL, '{"status": "DRAFT"}', '192.168.1.101', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'),
('audit-004', 'submission', 'sub-002', '550e8400-e29b-41d4-a716-446655440003', 'NODAL_OFFICER', 'UPDATE', '{"status": "DRAFT"}', '{"status": "SUBMITTED_TO_STATE"}', '192.168.1.101', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'),
('audit-005', 'submission', 'sub-002', '550e8400-e29b-41d4-a716-446655440005', 'STATE_APPROVER', 'UPDATE', '{"status": "SUBMITTED_TO_STATE"}', '{"status": "SUBMITTED_TO_MOSPI_REVIEWER"}', '192.168.1.102', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36');
```

### 4. Data Verify करना

```sql
-- Users count
SELECT COUNT(*) as user_count FROM users;

-- Users data
SELECT id, email, "firstName", "lastName", role, "stateUt", "isActive" FROM users;

-- Submissions count
SELECT COUNT(*) as submission_count FROM submissions;

-- Submissions data
SELECT id, "submissionId", "stateUt", status, "currentOwnerRole", "createdAt" FROM submissions;

-- Final scores count
SELECT COUNT(*) as score_count FROM final_scores;

-- Final scores data
SELECT id, "submissionId", "stateUt", "totalScore", "approvedBy" FROM final_scores;

-- Audit logs count
SELECT COUNT(*) as audit_count FROM audit_logs;

-- Complete summary
SELECT
    (SELECT COUNT(*) FROM users) as user_count,
    (SELECT COUNT(*) FROM submissions) as submission_count,
    (SELECT COUNT(*) FROM final_scores) as score_count,
    (SELECT COUNT(*) FROM audit_logs) as audit_count;
```

## 🎯 Quick Commands

### File से run करना:

```sql
\i create-tables.sql
\i seed-data.sql
```

### Manual copy-paste:

ऊपर दिए गए SQL commands को step-by-step copy-paste करें।

## ✅ Expected Results

- **7 Users** (1 admin, 2 nodal officers, 2 state approvers, 2 reviewers)
- **5 Submissions** (different states के)
- **2 Final Scores** (evaluation results)
- **5 Audit Logs** (system activities)

सभी data successfully insert हो जाना चाहिए!
