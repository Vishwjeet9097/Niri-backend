-- ==========================================
-- NIRI Database - Data Only Backup
-- Database: niri_db
-- Backup Date: 2025-10-13
-- ==========================================

-- ==========================================
-- USERS TABLE DATA
-- ==========================================
-- Clear existing users (optional)
-- DELETE FROM users;

INSERT INTO users (id, email, password, "firstName", "lastName", "contact_number", role, "state_ut", "isActive", "createdAt", "updatedAt") VALUES
('11111111-1111-1111-1111-111111111111', 'nodal@niri.gov.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K', 'Nodal', 'Officer', NULL, 'NODAL_OFFICER', 'Maharashtra', true, '2025-10-12T16:46:10.705Z', '2025-10-12T16:46:10.705Z'),
('22222222-2222-2222-2222-222222222222', 'state@niri.gov.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K', 'State', 'Approver', NULL, 'STATE_APPROVER', 'Maharashtra', true, '2025-10-12T16:46:10.705Z', '2025-10-12T16:46:10.705Z'),
('33333333-3333-3333-3333-333333333333', 'mospi.reviewer@niri.gov.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K', 'MoSPI', 'Reviewer', NULL, 'MOSPI_REVIEWER', 'Central', true, '2025-10-12T16:46:10.705Z', '2025-10-12T16:46:10.705Z'),
('44444444-4444-4444-4444-444444444444', 'mospi.approver@niri.gov.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K', 'MoSPI', 'Approver', NULL, 'MOSPI_APPROVER', 'Central', true, '2025-10-12T16:46:10.705Z', '2025-10-12T16:46:10.705Z')
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- SUBMISSIONS TABLE DATA
-- ==========================================
-- No data currently in submissions table

-- ==========================================
-- FINAL SCORES TABLE DATA
-- ==========================================
-- No data currently in final_scores table

-- ==========================================
-- AUDIT LOGS TABLE DATA
-- ==========================================
-- No data currently in audit_logs table

-- ==========================================
-- VERIFICATION
-- ==========================================
SELECT 'Data Backup Completed!' as status;
SELECT 'Users imported:' as info, COUNT(*) as count FROM users;

-- ==========================================
-- BACKUP SUMMARY
-- ==========================================
SELECT '=== NIRI DATABASE DATA BACKUP SUMMARY ===' as title;
SELECT 'Backup Date: 2025-10-13' as backup_date;
SELECT 'Database: niri_db' as database_name;
SELECT 'Users: 4' as user_count;
SELECT 'Submissions: 0' as submission_count;
SELECT 'Final Scores: 0' as score_count;
SELECT 'Audit Logs: 0' as audit_count;
SELECT 'Status: Complete' as status;
