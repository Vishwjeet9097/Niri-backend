-- NIRI Users Insert Query
-- यह query सभी users insert करने के लिए है

-- Clear existing users (optional - uncomment if you want to reset)
-- DELETE FROM users;

-- Insert all users with proper UUIDs and hashed passwords
INSERT INTO users (id, email, password, "firstName", "lastName", "contactNumber", role, "stateUt", "isActive", "createdAt", "updatedAt") VALUES
('550e8400-e29b-41d4-a716-446655440001', 'admin@niri.gov.in', '$2b$10$rQZ8K9vL8xN5mP2qR1sT3uV4wX7yZ9aB2cD5eF8gH1jK4mN7pQ0sT3uV6wX9zA', 'System', 'Administrator', '+91-9876543210', 'MOSPI_APPROVER', 'Central', true, NOW(), NOW()),

('550e8400-e29b-41d4-a716-446655440002', 'maharashtra.nodal@niri.gov.in', '$2b$10$rQZ8K9vL8xN5mP2qR1sT3uV4wX7yZ9aB2cD5eF8gH1jK4mN7pQ0sT3uV6wX9zA', 'Rajesh', 'Kumar', '+91-9876543211', 'NODAL_OFFICER', 'Maharashtra', true, NOW(), NOW()),

('550e8400-e29b-41d4-a716-446655440003', 'karnataka.nodal@niri.gov.in', '$2b$10$rQZ8K9vL8xN5mP2qR1sT3uV4wX7yZ9aB2cD5eF8gH1jK4mN7pQ0sT3uV6wX9zA', 'Priya', 'Sharma', '+91-9876543212', 'NODAL_OFFICER', 'Karnataka', true, NOW(), NOW()),

('550e8400-e29b-41d4-a716-446655440004', 'maharashtra.approver@niri.gov.in', '$2b$10$rQZ8K9vL8xN5mP2qR1sT3uV4wX7yZ9aB2cD5eF8gH1jK4mN7pQ0sT3uV6wX9zA', 'Amit', 'Singh', '+91-9876543213', 'STATE_APPROVER', 'Maharashtra', true, NOW(), NOW()),

('550e8400-e29b-41d4-a716-446655440005', 'karnataka.approver@niri.gov.in', '$2b$10$rQZ8K9vL8xN5mP2qR1sT3uV4wX7yZ9aB2cD5eF8gH1jK4mN7pQ0sT3uV6wX9zA', 'Sneha', 'Patel', '+91-9876543214', 'STATE_APPROVER', 'Karnataka', true, NOW(), NOW()),

('550e8400-e29b-41d4-a716-446655440006', 'reviewer1@niri.gov.in', '$2b$10$rQZ8K9vL8xN5mP2qR1sT3uV4wX7yZ9aB2cD5eF8gH1jK4mN7pQ0sT3uV6wX9zA', 'Dr. Vikram', 'Joshi', '+91-9876543215', 'MOSPI_REVIEWER', 'Central', true, NOW(), NOW()),

('550e8400-e29b-41d4-a716-446655440007', 'reviewer2@niri.gov.in', '$2b$10$rQZ8K9vL8xN5mP2qR1sT3uV4wX7yZ9aB2cD5eF8gH1jK4mN7pQ0sT3uV6wX9zA', 'Dr. Anjali', 'Mehta', '+91-9876543216', 'MOSPI_REVIEWER', 'Central', true, NOW(), NOW())

ON CONFLICT (id) DO NOTHING;

-- Verify users were inserted
SELECT 
    'Users inserted successfully!' as message,
    COUNT(*) as total_users,
    COUNT(CASE WHEN "role" = 'MOSPI_APPROVER' THEN 1 END) as mospi_approvers,
    COUNT(CASE WHEN "role" = 'NODAL_OFFICER' THEN 1 END) as nodal_officers,
    COUNT(CASE WHEN "role" = 'STATE_APPROVER' THEN 1 END) as state_approvers,
    COUNT(CASE WHEN "role" = 'MOSPI_REVIEWER' THEN 1 END) as mospi_reviewers;

-- Show all users
SELECT id, email, "firstName", "lastName", "role", "stateUt", "isActive", "createdAt" 
FROM users 
ORDER BY "createdAt" DESC;
