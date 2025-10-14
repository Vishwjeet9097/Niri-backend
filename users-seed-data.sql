-- ==========================================
-- NIRI Users Seed Data Script
-- Table schema के according users insert करने के लिए
-- ==========================================

-- Clear existing users (optional - uncomment if you want to reset)
-- DELETE FROM users;

-- Insert users with proper schema structure
INSERT INTO users (id, email, password, "firstName", "lastName", "contact_number", role, "stateUt", "isActive", "createdAt", "updatedAt") VALUES

-- Central Level Users (MoSPI)
('11111111-1111-1111-1111-111111111111', 'mospi.approver@niri.gov.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K', 'MoSPI', 'Approver', '+91-9876543210', 'MOSPI_APPROVER', 'Central', true, NOW(), NOW()),
('33333333-3333-3333-3333-333333333333', 'mospi.reviewer@niri.gov.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K', 'MoSPI', 'Reviewer', '+91-9876543211', 'MOSPI_REVIEWER', 'Central', true, NOW(), NOW()),

-- Maharashtra State Users
('550e8400-e29b-41d4-a716-446655440001', 'maharashtra.nodal@niri.gov.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K', 'Rajesh', 'Kumar', '+91-9876543212', 'NODAL_OFFICER', 'Maharashtra', true, NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440002', 'maharashtra.approver@niri.gov.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K', 'Amit', 'Singh', '+91-9876543213', 'STATE_APPROVER', 'Maharashtra', true, NOW(), NOW()),

-- Karnataka State Users
('550e8400-e29b-41d4-a716-446655440003', 'karnataka.nodal@niri.gov.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K', 'Priya', 'Sharma', '+91-9876543214', 'NODAL_OFFICER', 'Karnataka', true, NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440004', 'karnataka.approver@niri.gov.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K', 'Sneha', 'Patel', '+91-9876543215', 'STATE_APPROVER', 'Karnataka', true, NOW(), NOW()),

-- Tamil Nadu State Users
('550e8400-e29b-41d4-a716-446655440005', 'tamilnadu.nodal@niri.gov.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K', 'Vikram', 'Joshi', '+91-9876543216', 'NODAL_OFFICER', 'Tamil Nadu', true, NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440006', 'tamilnadu.approver@niri.gov.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K', 'Anjali', 'Mehta', '+91-9876543217', 'STATE_APPROVER', 'Tamil Nadu', true, NOW(), NOW()),

-- Gujarat State Users
('550e8400-e29b-41d4-a716-446655440007', 'gujarat.nodal@niri.gov.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K', 'Ravi', 'Patel', '+91-9876543218', 'NODAL_OFFICER', 'Gujarat', true, NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440008', 'gujarat.approver@niri.gov.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K', 'Sunita', 'Shah', '+91-9876543219', 'STATE_APPROVER', 'Gujarat', true, NOW(), NOW()),

-- Delhi State Users
('550e8400-e29b-41d4-a716-446655440009', 'delhi.nodal@niri.gov.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K', 'Arjun', 'Verma', '+91-9876543220', 'NODAL_OFFICER', 'Delhi', true, NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440010', 'delhi.approver@niri.gov.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K', 'Kavita', 'Gupta', '+91-9876543221', 'STATE_APPROVER', 'Delhi', true, NOW(), NOW()),

-- Additional MoSPI Reviewers
('550e8400-e29b-41d4-a716-446655440011', 'mospi.reviewer2@niri.gov.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K', 'Dr. Sanjay', 'Agarwal', '+91-9876543222', 'MOSPI_REVIEWER', 'Central', true, NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440012', 'mospi.reviewer3@niri.gov.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K', 'Dr. Meera', 'Reddy', '+91-9876543223', 'MOSPI_REVIEWER', 'Central', true, NOW(), NOW())

ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- VERIFICATION QUERIES
-- ==========================================

-- Check total users inserted
SELECT 
    'Users seeded successfully!' as message,
    COUNT(*) as total_users,
    COUNT(CASE WHEN "role" = 'MOSPI_APPROVER' THEN 1 END) as mospi_approvers,
    COUNT(CASE WHEN "role" = 'MOSPI_REVIEWER' THEN 1 END) as mospi_reviewers,
    COUNT(CASE WHEN "role" = 'NODAL_OFFICER' THEN 1 END) as nodal_officers,
    COUNT(CASE WHEN "role" = 'STATE_APPROVER' THEN 1 END) as state_approvers;

-- Show users by role
SELECT 
    'Users by Role:' as category,
    "role",
    COUNT(*) as count
FROM users 
GROUP BY "role" 
ORDER BY "role";

-- Show users by state
SELECT 
    'Users by State:' as category,
    "stateUt",
    COUNT(*) as count
FROM users 
GROUP BY "stateUt" 
ORDER BY "stateUt";

-- Show all users with details
SELECT 
    'All Users Details:' as category;
    
SELECT 
    id,
    email,
    "firstName",
    "lastName",
    "contact_number",
    "role",
    "stateUt",
    "isActive",
    "createdAt"
FROM users 
ORDER BY "role", "stateUt", "createdAt";

-- ==========================================
-- SUCCESS MESSAGE
-- ==========================================
SELECT '=== USERS SEEDED SUCCESSFULLY ===' as final_status;
SELECT 'All users have been inserted with proper schema structure.' as message;
SELECT 'You can now use these users for testing the NIRI application.' as next_steps;
