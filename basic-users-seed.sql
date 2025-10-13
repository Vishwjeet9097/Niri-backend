-- ==========================================
-- NIRI Basic Users Seed Script
-- सिर्फ essential users insert करने के लिए
-- ==========================================

-- Insert basic users for testing
INSERT INTO users (id, email, password, "firstName", "lastName", "contactNumber", role, "stateUt", "isActive", "createdAt", "updatedAt") VALUES

-- Default users (same as in migrations)
('11111111-1111-1111-1111-111111111111', 'nodal@niri.gov.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K', 'Nodal', 'Officer', '+91-9876543210', 'NODAL_OFFICER', 'Maharashtra', true, NOW(), NOW()),
('22222222-2222-2222-2222-222222222222', 'state@niri.gov.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K', 'State', 'Approver', '+91-9876543211', 'STATE_APPROVER', 'Maharashtra', true, NOW(), NOW()),
('33333333-3333-3333-3333-333333333333', 'mospi.reviewer@niri.gov.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K', 'MoSPI', 'Reviewer', '+91-9876543212', 'MOSPI_REVIEWER', 'Central', true, NOW(), NOW()),
('44444444-4444-4444-4444-444444444444', 'mospi.approver@niri.gov.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K', 'MoSPI', 'Approver', '+91-9876543213', 'MOSPI_APPROVER', 'Central', true, NOW(), NOW())

ON CONFLICT (id) DO NOTHING;

-- Verify insertion
SELECT 
    'Basic users inserted!' as message,
    COUNT(*) as total_users
FROM users;

-- Show inserted users
SELECT email, "firstName", "lastName", role, "stateUt" 
FROM users 
ORDER BY role;
