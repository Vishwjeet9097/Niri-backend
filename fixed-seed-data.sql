-- Fixed NIRI Database Seed Data Script
-- यह script corrected UUIDs के साथ dummy data insert करने के लिए है

-- 1. Users Data (already inserted successfully)
-- Users data was already inserted successfully in your previous run

-- 2. Submissions Data (with correct UUIDs)
INSERT INTO submissions (id, "submissionId", "stateUt", "submittedBy", "formData", status, "currentOwnerRole") VALUES
('550e8400-e29b-41d4-a716-446655440010', 'MAH-2024-001', 'Maharashtra', '550e8400-e29b-41d4-a716-446655440002', 
 '{"infrastructure": {"transport": 85, "water": 78, "energy": 92, "telecom": 88, "healthcare": 76, "education": 82}, "population": 120000000, "area": 307713}', 
 'SUBMITTED_TO_STATE', 'STATE_APPROVER'),

('550e8400-e29b-41d4-a716-446655440011', 'KAR-2024-001', 'Karnataka', '550e8400-e29b-41d4-a716-446655440003', 
 '{"infrastructure": {"transport": 88, "water": 82, "energy": 95, "telecom": 91, "healthcare": 84, "education": 89}, "population": 64000000, "area": 191791}', 
 'SUBMITTED_TO_MOSPI_REVIEWER', 'MOSPI_REVIEWER'),

('550e8400-e29b-41d4-a716-446655440012', 'TAM-2024-001', 'Tamil Nadu', '550e8400-e29b-41d4-a716-446655440002', 
 '{"infrastructure": {"transport": 79, "water": 85, "energy": 87, "telecom": 83, "healthcare": 88, "education": 85}, "population": 72000000, "area": 130058}', 
 'DRAFT', 'NODAL_OFFICER'),

('550e8400-e29b-41d4-a716-446655440013', 'GUJ-2024-001', 'Gujarat', '550e8400-e29b-41d4-a716-446655440002', 
 '{"infrastructure": {"transport": 82, "water": 79, "energy": 89, "telecom": 86, "healthcare": 81, "education": 87}, "population": 60000000, "area": 196024}', 
 'APPROVED', 'MOSPI_APPROVER'),

('550e8400-e29b-41d4-a716-446655440014', 'DEL-2024-001', 'Delhi', '550e8400-e29b-41d4-a716-446655440002', 
 '{"infrastructure": {"transport": 91, "water": 74, "energy": 93, "telecom": 94, "healthcare": 89, "education": 91}, "population": 20000000, "area": 1484}', 
 'SUBMITTED_TO_MOSPI_APPROVER', 'MOSPI_APPROVER')
ON CONFLICT (id) DO NOTHING;

-- 3. Final Scores Data (with correct UUIDs)
INSERT INTO final_scores (id, "submissionId", "stateUt", "totalScore", "scoreBreakdown", "calculationMethodology", "approvedBy") VALUES
('550e8400-e29b-41d4-a716-446655440020', '550e8400-e29b-41d4-a716-446655440011', 'Karnataka', 87.5, 
 '{"transport": 88, "water": 82, "energy": 95, "telecom": 91, "healthcare": 84, "education": 89, "weighted_average": 87.5}', 
 'Weighted average calculation based on infrastructure categories with energy and telecom having higher weights', 
 '550e8400-e29b-41d4-a716-446655440001'),

('550e8400-e29b-41d4-a716-446655440021', '550e8400-e29b-41d4-a716-446655440013', 'Gujarat', 84.0, 
 '{"transport": 82, "water": 79, "energy": 89, "telecom": 86, "healthcare": 81, "education": 87, "weighted_average": 84.0}', 
 'Standard weighted average with equal weights for all infrastructure categories', 
 '550e8400-e29b-41d4-a716-446655440001')
ON CONFLICT (id) DO NOTHING;

-- 4. Audit Logs Data (with correct UUIDs)
INSERT INTO audit_logs (id, "entityType", "entityId", "userId", "userRole", action, "oldValues", "newValues", "ipAddress", "userAgent") VALUES
('550e8400-e29b-41d4-a716-446655440030', 'submission', '550e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440002', 'NODAL_OFFICER', 'CREATE', NULL, '{"status": "DRAFT"}', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'),
('550e8400-e29b-41d4-a716-446655440031', 'submission', '550e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440002', 'NODAL_OFFICER', 'UPDATE', '{"status": "DRAFT"}', '{"status": "SUBMITTED_TO_STATE"}', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'),
('550e8400-e29b-41d4-a716-446655440032', 'submission', '550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440003', 'NODAL_OFFICER', 'CREATE', NULL, '{"status": "DRAFT"}', '192.168.1.101', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'),
('550e8400-e29b-41d4-a716-446655440033', 'submission', '550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440003', 'NODAL_OFFICER', 'UPDATE', '{"status": "DRAFT"}', '{"status": "SUBMITTED_TO_STATE"}', '192.168.1.101', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'),
('550e8400-e29b-41d4-a716-446655440034', 'submission', '550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440005', 'STATE_APPROVER', 'UPDATE', '{"status": "SUBMITTED_TO_STATE"}', '{"status": "SUBMITTED_TO_MOSPI_REVIEWER"}', '192.168.1.102', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36')
ON CONFLICT (id) DO NOTHING;

-- Success message with data summary
SELECT 
    'Data seeded successfully!' as message,
    (SELECT COUNT(*) FROM users) as user_count,
    (SELECT COUNT(*) FROM submissions) as submission_count,
    (SELECT COUNT(*) FROM final_scores) as score_count,
    (SELECT COUNT(*) FROM audit_logs) as audit_count;
