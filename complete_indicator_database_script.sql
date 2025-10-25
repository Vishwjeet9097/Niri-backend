-- =====================================================
-- NIRI Backend - Complete Indicator Database Script
-- =====================================================
-- This script contains all indicator-related database changes
-- including table creation, data seeding, and modifications
-- Date: 2025-01-23
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. CREATE INDICATORS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS "indicators" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "code" character varying(50) NOT NULL,
    "section_id" character varying(50) NOT NULL,
    "indicator_name" character varying(255) NOT NULL,
    "category" character varying(255) NOT NULL,
    "max_score" numeric(10,2) NOT NULL,
    "is_active" boolean NOT NULL DEFAULT true,
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "UQ_indicators_code" UNIQUE ("code"),
    CONSTRAINT "PK_indicators" PRIMARY KEY ("id")
);

-- =====================================================
-- 2. CREATE STATES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS "states" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "name" character varying(255) NOT NULL,
    "state_code" character varying(10) NOT NULL,
    "is_active" boolean NOT NULL DEFAULT true,
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "UQ_states_name" UNIQUE ("name"),
    CONSTRAINT "UQ_states_state_code" UNIQUE ("state_code"),
    CONSTRAINT "PK_states" PRIMARY KEY ("id")
);

-- =====================================================
-- 3. CREATE USER_INDICATOR_SCOPE TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS "user_indicator_scope" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" uuid NOT NULL,
    "indicator_id" uuid NOT NULL,
    "is_active" boolean NOT NULL DEFAULT true,
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "UQ_user_indicator_scope_user_indicator" UNIQUE ("user_id", "indicator_id"),
    CONSTRAINT "PK_user_indicator_scope" PRIMARY KEY ("id")
);

-- =====================================================
-- 4. ADD INDICATOR_COMMENT COLUMN TO SUBMISSIONS TABLE
-- =====================================================
-- Check if indicator_comment column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'submissions' 
        AND column_name = 'indicator_comment'
    ) THEN
        ALTER TABLE "submissions" 
        ADD COLUMN "indicator_comment" jsonb DEFAULT '{}';
    END IF;
END $$;

-- =====================================================
-- 5. CREATE INDEXES
-- =====================================================
-- Indicators table indexes
CREATE INDEX IF NOT EXISTS "IDX_indicators_code" ON "indicators" ("code");
CREATE INDEX IF NOT EXISTS "IDX_indicators_section_id" ON "indicators" ("section_id");
CREATE INDEX IF NOT EXISTS "IDX_indicators_category" ON "indicators" ("category");

-- States table indexes
CREATE INDEX IF NOT EXISTS "IDX_states_name" ON "states" ("name");
CREATE INDEX IF NOT EXISTS "IDX_states_state_code" ON "states" ("state_code");

-- User indicator scope indexes
CREATE INDEX IF NOT EXISTS "IDX_user_indicator_scope_user_id" ON "user_indicator_scope" ("user_id");
CREATE INDEX IF NOT EXISTS "IDX_user_indicator_scope_indicator_id" ON "user_indicator_scope" ("indicator_id");
CREATE INDEX IF NOT EXISTS "IDX_user_indicator_scope_unique" ON "user_indicator_scope" ("user_id", "indicator_id");

-- =====================================================
-- 6. ADD FOREIGN KEY CONSTRAINTS
-- =====================================================
-- Add foreign key constraints for user_indicator_scope table
DO $$
BEGIN
    -- Check if foreign key constraint exists for user_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'FK_user_indicator_scope_user_id'
    ) THEN
        ALTER TABLE "user_indicator_scope" 
        ADD CONSTRAINT "FK_user_indicator_scope_user_id" 
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
    END IF;

    -- Check if foreign key constraint exists for indicator_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'FK_user_indicator_scope_indicator_id'
    ) THEN
        ALTER TABLE "user_indicator_scope" 
        ADD CONSTRAINT "FK_user_indicator_scope_indicator_id" 
        FOREIGN KEY ("indicator_id") REFERENCES "indicators"("id") ON DELETE CASCADE;
    END IF;
END $$;

-- =====================================================
-- 7. INSERT NIRI INDICATORS DATA
-- =====================================================
-- Clear existing indicators data first
DELETE FROM "indicators" WHERE 1=1;

-- Insert NIRI Indicators
INSERT INTO "indicators" ("code", "section_id", "indicator_name", "category", "max_score") VALUES
('1.1', '1', '% of Capex to GSDP', 'Infrastructure Financing', 50.00),
('1.2', '1', '% Capex Utilization', 'Infrastructure Financing', 50.00),
('1.3', '1', '% of Credit Rated ULBs', 'Infrastructure Financing', 50.00),
('1.4', '1', '% of ULBs Issuing Bonds', 'Infrastructure Financing', 50.00),
('1.5', '1', 'Functional Financial Intermediary', 'Infrastructure Financing', 50.00),
('2.1', '2', 'Availability of Infrastructure Act/Policy', 'Infrastructure Development', 50.00),
('2.2', '2', 'Availability of Specialized Entity', 'Infrastructure Development', 50.00),
('2.3', '2', 'Sector Infra Development Plan', 'Infrastructure Development', 50.00),
('2.4', '2', 'Investment Ready Project Pipeline', 'Infrastructure Development', 50.00),
('2.5', '2', 'Asset Monetization Pipeline', 'Infrastructure Development', 50.00),
('3.1', '3', 'Availability of PPP Act/Policy', 'PPP Development', 50.00),
('3.2', '3', 'Functional PPP Cell/Unit', 'PPP Development', 50.00),
('3.3', '3', 'Proposals under VGF/IIPDF', 'PPP Development', 50.00),
('3.4', '3', 'Proportion of TPC of PPP Projects', 'PPP Development', 100.00),
('4.1', '4', 'All Eligible Infra Projects on NIP Portal', 'Infrastructure Enablers', 50.00),
('4.2', '4', 'Availability & Use of State/UT PMG', 'Infrastructure Enablers', 30.00),
('4.3', '4', 'Adoption of PM GatiShakti', 'Infrastructure Enablers', 20.00),
('4.4', '4', 'Adoption of ADR', 'Infrastructure Enablers', 50.00),
('4.5', '4', 'Innovative Practices', 'Infrastructure Enablers', 50.00),
('4.6', '4', 'Capacity Building - Officer Participation', 'Infrastructure Enablers', 50.00);

-- =====================================================
-- 8. INSERT COMPLETE STATES AND UNION TERRITORIES DATA
-- =====================================================
-- Clear existing states data first
DELETE FROM "states" WHERE 1=1;

-- Insert all Indian States and Union Territories
INSERT INTO "states" ("name", "state_code") VALUES
-- States (28)
('Andhra Pradesh', 'AP'),
('Arunachal Pradesh', 'AR'),
('Assam', 'AS'),
('Bihar', 'BR'),
('Chhattisgarh', 'CG'),
('Goa', 'GA'),
('Gujarat', 'GJ'),
('Haryana', 'HR'),
('Himachal Pradesh', 'HP'),
('Jharkhand', 'JH'),
('Karnataka', 'KA'),
('Kerala', 'KL'),
('Madhya Pradesh', 'MP'),
('Maharashtra', 'MH'),
('Manipur', 'MN'),
('Meghalaya', 'ML'),
('Mizoram', 'MZ'),
('Nagaland', 'NL'),
('Odisha', 'OR'),
('Punjab', 'PB'),
('Rajasthan', 'RJ'),
('Sikkim', 'SK'),
('Tamil Nadu', 'TN'),
('Telangana', 'TG'),
('Tripura', 'TR'),
('Uttar Pradesh', 'UP'),
('Uttarakhand', 'UK'),
('West Bengal', 'WB'),

-- Union Territories (8)
('Andaman and Nicobar Islands', 'AN'),
('Chandigarh', 'CH'),
('Dadra and Nagar Haveli and Daman and Diu', 'DN'),
('Delhi', 'DL'),
('Jammu and Kashmir', 'JK'),
('Ladakh', 'LA'),
('Lakshadweep', 'LD'),
('Puducherry', 'PY');

-- =====================================================
-- 9. UPDATE MIGRATIONS TABLE (if exists)
-- =====================================================
-- Insert migration records to track these changes
INSERT INTO "migrations" ("timestamp", "name") VALUES
(1760437774176, 'AddIndicatorTables1760437774176'),
(1760437775000, 'CreateIndicatorTables1760437775000')
ON CONFLICT (timestamp) DO NOTHING;

-- =====================================================
-- 10. VERIFICATION QUERIES
-- =====================================================
-- Verify indicators table
SELECT 'Indicators Count: ' || COUNT(*) as verification FROM "indicators";

-- Verify states table
SELECT 'States Count: ' || COUNT(*) as verification FROM "states";

-- Verify user_indicator_scope table structure
SELECT 'User Indicator Scope Table Exists: ' || 
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_indicator_scope') 
       THEN 'YES' ELSE 'NO' END as verification;

-- Verify indicator_comment column in submissions
SELECT 'Indicator Comment Column Exists: ' || 
       CASE WHEN EXISTS (
           SELECT 1 FROM information_schema.columns 
           WHERE table_name = 'submissions' AND column_name = 'indicator_comment'
       ) THEN 'YES' ELSE 'NO' END as verification;

-- =====================================================
-- SCRIPT COMPLETION MESSAGE
-- =====================================================
SELECT 'NIRI Indicator Database Script Completed Successfully!' as status;
