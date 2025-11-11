-- =====================================================
-- NIRI Backend - Seed Data Script
-- =====================================================
-- यह script database में seed data insert करता है:
-- 1. Single Admin User
-- 2. All Indicators (18 indicators from images)
-- Date: 2025-01-27
-- =====================================================

-- =====================================================
-- 1. INSERT ADMIN USER
-- =====================================================
-- Password: admin123 (hashed with bcrypt rounds 12)
-- You can change this password after first login
-- Insert Admin User with ADMIN role
INSERT INTO "users" (
    "id",
    "email",
    "password",
    "firstName",
    "lastName",
    "contactNumber",
    "role",
    "state_ut",
    "isActive",
    "createdAt",
    "updatedAt",
    "indicator_comment"
) VALUES (
    uuid_generate_v4(),
    'admin@niri_dev.nic.in',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K', -- password: password123
    'Admin',
    'User',
    '9876543210',
    'ADMIN'::user_role,  -- Role is ADMIN
    'Central',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    '{}'::jsonb
)
ON CONFLICT ("email") DO NOTHING;

-- =====================================================
-- 2. INSERT ALL INDICATORS
-- =====================================================
-- Inserting 18 indicators from the database images
INSERT INTO "indicators" (
    "id",
    "code",
    "section_id",
    "indicator_name",
    "category",
    "max_score",
    "is_active",
    "created_at",
    "updated_at"
) VALUES 
-- Section 1: Infrastructure Financing
(uuid_generate_v4(), '1.1', '1', '% of Capex to GSDP', 'Infrastructure Financing', 50.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(uuid_generate_v4(), '1.2', '1', '% Capex Utilization', 'Infrastructure Financing', 50.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(uuid_generate_v4(), '1.3', '1', '% of Credit Rated ULBS', 'Infrastructure Financing', 50.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(uuid_generate_v4(), '1.4', '1', '% of ULBS Issuing Bonds', 'Infrastructure Financing', 50.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(uuid_generate_v4(), '1.5', '1', 'Functional Financial Intermediary', 'Infrastructure Financing', 50.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Section 2: Infrastructure Development
(uuid_generate_v4(), '2.1', '2', 'Availability of Infrastructure Act/Policy', 'Infrastructure Development', 50.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(uuid_generate_v4(), '2.2', '2', 'Availability of Specialized Entity', 'Infrastructure Development', 50.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(uuid_generate_v4(), '2.3', '2', 'Sector Infra Development Plan', 'Infrastructure Development', 50.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(uuid_generate_v4(), '2.4', '2', 'Investment Ready Project Pipeline', 'Infrastructure Development', 50.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(uuid_generate_v4(), '2.5', '2', 'Asset Monetization Pipeline', 'Infrastructure Development', 50.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Section 3: PPP Development
(uuid_generate_v4(), '3.1', '3', 'Availability of PPP Act/Policy', 'PPP Development', 50.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(uuid_generate_v4(), '3.2', '3', 'Functional PPP Cell/Unit', 'PPP Development', 50.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(uuid_generate_v4(), '3.3', '3', 'Proposals under VGF/IIPDF', 'PPP Development', 50.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(uuid_generate_v4(), '3.4', '3', 'Proportion of TPC of PPP Projects', 'PPP Development', 100.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),

-- Section 4: Infrastructure Enablers
(uuid_generate_v4(), '4.1', '4', 'All Eligible Infra Projects on NIP Portal', 'Infrastructure Enablers', 50.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(uuid_generate_v4(), '4.2', '4', 'Availability & Use of State/UT PMG', 'Infrastructure Enablers', 30.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(uuid_generate_v4(), '4.3', '4', 'Adoption of PM GatiShakti', 'Infrastructure Enablers', 20.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(uuid_generate_v4(), '4.4', '4', 'Adoption of ADR', 'Infrastructure Enablers', 50.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(uuid_generate_v4(), '4.5', '4', 'Innovative Practices', 'Infrastructure Enablers', 50.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(uuid_generate_v4(), '4.6', '4', 'Capacity Building - Officer Participation', 'Infrastructure Enablers', 50.00, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)

ON CONFLICT ("code") DO NOTHING;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
SELECT '=== SEED DATA INSERTED SUCCESSFULLY ===' as status;

-- Check admin user
SELECT 
    'Admin User:' as category,
    "id",
    "email",
    "firstName",
    "lastName",
    "role",
    "state_ut",
    "isActive"
FROM "users"
WHERE "role" = 'ADMIN'::user_role;

-- Check indicators count
SELECT 
    'Indicators Summary:' as category,
    COUNT(*) as total_indicators,
    COUNT(CASE WHEN "section_id" = '1' THEN 1 END) as section_1_count,
    COUNT(CASE WHEN "section_id" = '2' THEN 1 END) as section_2_count,
    COUNT(CASE WHEN "section_id" = '3' THEN 1 END) as section_3_count,
    COUNT(CASE WHEN "section_id" = '4' THEN 1 END) as section_4_count
FROM "indicators";

-- Show all indicators by section
SELECT 
    'Indicators by Section:' as category,
    "section_id",
    "category",
    COUNT(*) as indicator_count
FROM "indicators"
GROUP BY "section_id", "category"
ORDER BY "section_id";

-- Show all indicators with details
SELECT 
    'All Indicators:' as category;
    
SELECT 
    "code",
    "section_id",
    "indicator_name",
    "category",
    "max_score",
    "is_active"
FROM "indicators"
ORDER BY "section_id", "code";

SELECT '=== SEEDING COMPLETED ===' as final_status;

