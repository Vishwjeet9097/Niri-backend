-- =====================================================
-- NIRI Backend - Complete Indicator Database Setup Script
-- =====================================================
-- यह script सभी indicator related tables को create करता है
-- और sample data भी insert करता है
-- Date: 2025-01-23
-- =====================================================

-- Enable UUID extension
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
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "UQ_user_indicator_scope_user_indicator" UNIQUE ("user_id", "indicator_id"),
    CONSTRAINT "PK_user_indicator_scope" PRIMARY KEY ("id")
);

-- =====================================================
-- 4. ADD INDICATOR_COMMENT COLUMN TO SUBMISSIONS TABLE
-- =====================================================
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
DO $$
BEGIN
    -- Foreign key for user_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'FK_user_indicator_scope_user_id'
    ) THEN
        ALTER TABLE "user_indicator_scope" 
        ADD CONSTRAINT "FK_user_indicator_scope_user_id" 
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
    END IF;

    -- Foreign key for indicator_id
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
-- Clear existing data
DELETE FROM "indicators" WHERE 1=1;

-- Insert NIRI Indicators
INSERT INTO "indicators" ("code", "section_id", "indicator_name", "category", "max_score") VALUES
-- Section 1: Infrastructure Financing
('1.1', '1', '% of Capex to GSDP', 'Infrastructure Financing', 50.00),
('1.2', '1', '% Capex Utilization', 'Infrastructure Financing', 50.00),
('1.3', '1', '% of Credit Rated ULBs', 'Infrastructure Financing', 50.00),
('1.4', '1', '% of ULBs Issuing Bonds', 'Infrastructure Financing', 50.00),
('1.5', '1', 'Functional Financial Intermediary', 'Infrastructure Financing', 50.00),

-- Section 2: Infrastructure Development
('2.1', '2', 'Availability of Infrastructure Act/Policy', 'Infrastructure Development', 50.00),
('2.2', '2', 'Availability of Specialized Entity', 'Infrastructure Development', 50.00),
('2.3', '2', 'Sector Infra Development Plan', 'Infrastructure Development', 50.00),
('2.4', '2', 'Investment Ready Project Pipeline', 'Infrastructure Development', 50.00),
('2.5', '2', 'Asset Monetization Pipeline', 'Infrastructure Development', 50.00),

-- Section 3: PPP Development
('3.1', '3', 'Availability of PPP Act/Policy', 'PPP Development', 50.00),
('3.2', '3', 'Functional PPP Cell/Unit', 'PPP Development', 50.00),
('3.3', '3', 'Proposals under VGF/IIPDF', 'PPP Development', 50.00),
('3.4', '3', 'Proportion of TPC of PPP Projects', 'PPP Development', 100.00),

-- Section 4: Infrastructure Enablers
('4.1', '4', 'All Eligible Infra Projects on NIP Portal', 'Infrastructure Enablers', 50.00),
('4.2', '4', 'Availability & Use of State/UT PMG', 'Infrastructure Enablers', 30.00),
('4.3', '4', 'Adoption of PM GatiShakti', 'Infrastructure Enablers', 20.00),
('4.4', '4', 'Adoption of ADR', 'Infrastructure Enablers', 50.00),
('4.5', '4', 'Innovative Practices', 'Infrastructure Enablers', 50.00),
('4.6', '4', 'Capacity Building - Officer Participation', 'Infrastructure Enablers', 50.00);

-- =====================================================
-- 8. INSERT STATES AND UNION TERRITORIES DATA
-- =====================================================
-- Clear existing data
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
-- 9. VERIFICATION QUERIES
-- =====================================================
-- Check table counts
SELECT 'Indicators Count: ' || COUNT(*) as verification FROM "indicators";
SELECT 'States Count: ' || COUNT(*) as verification FROM "states";
SELECT 'User Indicator Scope Table Exists: ' || 
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_indicator_scope') 
       THEN 'YES' ELSE 'NO' END as verification;

-- Check indicators by category
SELECT category, COUNT(*) as count FROM indicators GROUP BY category ORDER BY category;

-- Check states by type
SELECT 
    CASE 
        WHEN name IN ('Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry') THEN 'Union Territory'
        ELSE 'State'
    END as state_type,
    COUNT(*) as count
FROM states
GROUP BY 
    CASE 
        WHEN name IN ('Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry') THEN 'Union Territory'
        ELSE 'State'
    END;

-- Final success message
SELECT 'NIRI Indicator Database Setup Completed Successfully!' as status;
