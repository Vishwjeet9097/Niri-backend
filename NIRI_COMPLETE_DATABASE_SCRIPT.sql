-- ==========================================
-- NIRI COMPLETE DATABASE SCRIPT
-- Database: niri_backend
-- Export Date: 2025-10-13
-- Description: Complete database schema and data for NIRI Backend
-- ==========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- DROP EXISTING TABLES (if they exist)
-- ==========================================
DROP TABLE IF EXISTS final_scores CASCADE;
DROP TABLE IF EXISTS submissions CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS migrations CASCADE;

-- Drop existing enums if they exist
DROP TYPE IF EXISTS submission_status CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

-- ==========================================
-- CREATE ENUMS
-- ==========================================
CREATE TYPE user_role AS ENUM (
    'NODAL_OFFICER',
    'STATE_APPROVER', 
    'MOSPI_REVIEWER',
    'MOSPI_APPROVER'
);

CREATE TYPE submission_status AS ENUM (
    'DRAFT',
    'SUBMITTED_TO_STATE',
    'SUBMITTED_TO_MOSPI_REVIEWER',
    'SUBMITTED_TO_MOSPI_APPROVER',
    'REJECTED',
    'REJECTED_FINAL',
    'RETURNED_FROM_STATE',
    'RETURNED_FROM_MOSPI',
    'APPROVED'
);

-- ==========================================
-- CREATE TABLES
-- ==========================================

-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    "firstName" VARCHAR(255) NOT NULL,
    "lastName" VARCHAR(255) NOT NULL,
    "contactNumber" VARCHAR(20),
    role user_role NOT NULL,
    "state_ut" VARCHAR(100) NOT NULL,
    "isActive" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Submissions Table
CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "submission_id" VARCHAR(255) UNIQUE NOT NULL,
    "state_ut" VARCHAR(100) NOT NULL,
    "submitted_by" UUID NOT NULL,
    "rejection_count" INTEGER DEFAULT 0,
    "form_data" JSONB NOT NULL,
    "review_comments" JSONB DEFAULT '[]'::jsonb,
    "attached_files" JSONB DEFAULT '{}'::jsonb,
    status submission_status DEFAULT 'SUBMITTED_TO_STATE',
    "current_owner_role" user_role DEFAULT 'STATE_APPROVER',
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY ("submitted_by") REFERENCES users(id) ON DELETE CASCADE
);

-- Final Scores Table
CREATE TABLE final_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "submission_id" UUID UNIQUE NOT NULL,
    "state_ut" VARCHAR(100) NOT NULL,
    "total_score" DECIMAL(10,2) NOT NULL,
    "score_breakdown" JSONB NOT NULL,
    "calculation_methodology" TEXT NOT NULL,
    "approved_by" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY ("submission_id") REFERENCES submissions(id) ON DELETE CASCADE
);

-- Audit Logs Table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" VARCHAR(255) NOT NULL,
    "user_id" VARCHAR(255) NOT NULL,
    "userRole" user_role NOT NULL,
    action VARCHAR(100) NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- CREATE INDEXES
-- ==========================================
CREATE INDEX IDX_users_email ON users(email);
CREATE INDEX IDX_users_state_ut_role ON users("state_ut", role);
CREATE INDEX IDX_submissions_state_ut ON submissions("state_ut");
CREATE INDEX IDX_submissions_status ON submissions(status);
CREATE INDEX IDX_submissions_submitted_by ON submissions("submitted_by");
CREATE INDEX IDX_submissions_current_owner_role ON submissions("current_owner_role");
CREATE INDEX IDX_submissions_attached_files ON submissions USING GIN("attached_files");
CREATE INDEX IDX_final_scores_state_ut ON final_scores("state_ut");
CREATE INDEX IDX_final_scores_total_score ON final_scores("total_score");
CREATE INDEX IDX_final_scores_created_at ON final_scores("createdAt");
CREATE INDEX IDX_audit_logs_entity ON audit_logs("entity_type", "entity_id");
CREATE INDEX IDX_audit_logs_user_id ON audit_logs("user_id");
CREATE INDEX IDX_audit_logs_action ON audit_logs(action);
CREATE INDEX IDX_audit_logs_created_at ON audit_logs("createdAt");

-- ==========================================
-- INSERT USERS DATA
-- ==========================================
INSERT INTO users (id, email, password, "firstName", "lastName", "contactNumber", role, "state_ut", "isActive", "createdAt", "updatedAt") VALUES
('6a6cd83e-84f3-465c-a5fc-a1f481eba118', 'maharashtra.nodal@maharashtra.gov.in', '$2a$12$WDJsA3tYVbw.KLgB1bGKm.8Rzvr0SMpApnWMQgcfvMZ/8cPdPienK', 'Rajesh', 'Kumar', NULL, 'NODAL_OFFICER', 'Gujarat', true, '2025-10-13 12:23:25.038682', '2025-10-13 12:23:25.038682'),
('829afe21-2055-4c32-9ad4-c5577317643a', 'maharashtra.state@maharashtra.gov.in', '$2a$12$7RyeKkJqSc0M/pdBkqATBuUUwfOOZXtRkxLvdqvx37A9XiY2lmeyW', 'Priya', 'Sharma', NULL, 'STATE_APPROVER', 'Gujarat', true, '2025-10-13 12:23:25.380125', '2025-10-13 12:23:25.380125'),
('714ad9a5-77c2-46e4-b7ab-56ca2afa203e', 'maharashtra.mospi.reviewer@mospi.gov.in', '$2a$12$2Ggw.O5jAHbN7f0W7Zg/TePQ9k/4ji6mul1vT0SrD/ioO2zo.WRV6', 'Amit', 'Patel', NULL, 'MOSPI_REVIEWER', 'Gujarat', true, '2025-10-13 12:23:25.696733', '2025-10-13 12:23:25.696733'),
('03e81af8-3811-493a-a882-7880f4c89b14', 'maharashtra.mospi.approver@mospi.gov.in', '$2a$12$0w06Jm/bg2088BPqrML9huPpy0vTcf4zLSD16q92rPBB18YPTJmkG', 'Sunita', 'Singh', NULL, 'MOSPI_APPROVER', 'Gujarat', true, '2025-10-13 12:23:26.015039', '2025-10-13 12:23:26.015039'),
('b168b811-27e1-4966-84eb-d5341b4517da', 'karnataka.nodal@karnataka.gov.in', '$2a$12$LPY6lf97atDkewRfR3H7POssk8jKp.2SCCZTXX9wOi3Ge1/d8u4fy', 'Vikram', 'Reddy', NULL, 'NODAL_OFFICER', 'Gujarat', true, '2025-10-13 12:23:26.334512', '2025-10-13 12:23:26.334512'),
('44f87a02-a4ca-4171-a5ee-1d8a68f96ef3', 'karnataka.state@karnataka.gov.in', '$2a$12$kwpbnjfKQvPMq9Jg8lDdqut43o.bBqeV/2fTo8B9mbSyBGGzWgS3i', 'Deepa', 'Nair', NULL, 'STATE_APPROVER', 'Gujarat', true, '2025-10-13 12:23:26.647269', '2025-10-13 12:23:26.647269'),
('d27f7265-4ad5-453f-a95a-ced1273ca104', 'tamilnadu.nodal@tamilnadu.gov.in', '$2a$12$RbhIt/d8v9yujXVfqeKXe.wPFG9rUCbPp6LU2Q1xbjjLHbOqrbIAq', 'Arun', 'Kumar', NULL, 'NODAL_OFFICER', 'Gujarat', true, '2025-10-13 12:23:26.971838', '2025-10-13 12:23:26.971838'),
('04769e33-139d-4dc9-91cc-0696e4d52aa9', 'tamilnadu.state@tamilnadu.gov.in', '$2a$12$SnwHh4UhJkkv2Joi/NgA..s6vfRJ16Lb3iIeipZY85H/GVVs9Tnym', 'Lakshmi', 'Raman', NULL, 'STATE_APPROVER', 'Gujarat', true, '2025-10-13 12:23:27.294273', '2025-10-13 12:23:27.294273'),
('554c8ac0-665a-488b-a3a0-3f227be1b752', 'gujarat.nodal@gujarat.gov.in', '$2a$12$EKYEbG5qj5FIXc1Tb8OWauubXPyZUV6b1BnTen/Pti5mwA5AgmI1y', 'Harsh', 'Patel', NULL, 'NODAL_OFFICER', 'Gujarat', true, '2025-10-13 12:23:27.613017', '2025-10-13 12:23:27.613017'),
('fa708fb7-1804-4b19-b343-b68856e694ae', 'gujarat.state@gujarat.gov.in', '$2a$12$xKi7DE/Ati0hMdHzIvg6dup15REn8JtiLP7Lq6hlYN42eVGSSA3lW', 'Kavita', 'Shah', NULL, 'STATE_APPROVER', 'Gujarat', true, '2025-10-13 12:23:27.93125', '2025-10-13 12:23:27.93125');

-- ==========================================
-- INSERT SUBMISSIONS DATA
-- ==========================================
INSERT INTO submissions (id, "submission_id", "state_ut", "submitted_by", "rejection_count", "form_data", "review_comments", "attached_files", status, "current_owner_role", "createdAt", "updatedAt") VALUES
('1006fa29-e229-4fbc-88d7-33e66dec8d36', 'SUB-2025-503953', 'Gujarat', '554c8ac0-665a-488b-a3a0-3f227be1b752', 0, '{"infraEnablers": {"section4_1": {"allEligible": "", "websiteLink": ""}, "section4_2": {"file": null, "available": ""}, "section4_3": {"file": null, "adopted": "", "marksObtained": 0, "numberOfProjects": ""}, "section4_4": {"file": null, "adopted": "", "marksObtained": 0}, "section4_5": {"file": null, "impact": "", "implemented": "", "practiceName": ""}, "section4_6": []}, "infraFinancing": {"section1_1": {"year": "2024-2025", "gsdpForFY": "250000", "percentage": 600, "stateCapex": "", "marksObtained": 50, "allocationToGSDP": "9", "capitalAllocation": "1500000", "capexToCapexActuals": "70", "stateCapexUtilisation": "1200000"}, "section1_2": {"year": "2025", "gsdpForFY": "145000", "percentage": 50.2, "actualCapex": "123000", "marksObtained": 25.1, "budgetaryCapex": "245000", "capexActualsToGSDP": "7", "stateCapexUtilisation": "332000"}, "section1_3": [{"id": "1760215297848", "ulb": "Mumbai Municipal Corporation", "rating": "A+", "cityName": "Mumbai", "ratingDate": "2025-10-22"}, {"id": "1760215320994", "ulb": "Nagpur Municipal Corporation", "rating": "A", "cityName": "New Delhi", "ratingDate": "2025-10-16"}], "section1_4": [{"id": "1760215337156", "value": "10000", "bondType": "Infrastructure bond", "cityName": "Pune", "issuingAuthority": "Development Authority"}], "section1_5": [{"id": "1760215057606", "website": "  \"status\": \"SUBMITTED_TO_STATE\"", "totalFunding": "1500", "yearEstablished": "2014", "organisationName": "GOV", "organisationType": "Development Authority"}]}, "pppDevelopment": {"section3_1": {"file": null, "available": "yes"}, "section3_2": {"file": null, "available": "no"}, "section3_3": [{"id": "bb5e32dc-4ee5-415e-a50a-b917703eaf25", "file": null, "type": "BOOT", "sector": "Water Supply", "projectName": "umag", "marksObtained": 5, "submissionDate": "2025-10-26"}], "section3_4": {"totalTPC": "1000", "proportion": 50, "marksObtained": 100, "tpcOfPPPProjects": "500"}}, "infraDevelopment": {"section2_1": [{"id": "9b178808-9b1f-4741-aa41-eeb34eb4ec26", "files": [{"id": "d9e60e49-5dbd-42c1-89d2-a6e00252a673", "file": {}, "fileName": "BRD-NIRI.docx", "fileSize": 129590, "uploadedAt": 1760215409278}], "sector": "Health"}], "section2_2": [{"id": "d319bfac-691f-47df-9a3a-7786cc5faac8", "files": [{"id": "fd4934cb-502c-44b0-a5fc-2355f131158f", "file": {}, "fileName": "BRD-NIRI.docx", "fileSize": 129590, "uploadedAt": 1760215416305}], "sector": "Water Supply"}], "section2_3": [{"id": "8aec36b8-9dbe-483f-9d4f-7ebcbcd987a2", "files": [{"id": "c13dd962-c1c3-45f9-a371-2b6f2d2feb67", "file": {}, "fileName": "BRD-NIRI.docx", "fileSize": 129590, "uploadedAt": 1760215422467}], "sector": "Sanitation"}], "section2_4": [{"id": "c59bd412-2034-441a-96e1-82d865f231a4", "dprFile": {"id": "7f7f4050-49e9-49ce-8e87-a5005c0672c4", "file": {}, "fileName": "BRD-NIRI.docx", "fileSize": 129590, "uploadedAt": 1760215430718}, "projectName": "gov"}], "section2_5": [{"id": "57ca8bcf-b62d-4aa9-aa7e-58c678fedb49", "type": "BOOT", "sector": "Water Supply", "ownership": "Revenue sharing", "projectName": "digi", "estimatedMonetization": "15000"}]}}', '[]', '{}', 'SUBMITTED_TO_STATE', 'STATE_APPROVER', '2025-10-13 12:25:04.090348', '2025-10-13 12:25:04.090348'),

('5e26bcda-f439-4771-9584-c31fe1ae138f', 'SUB-2025-608192', 'Gujarat', '554c8ac0-665a-488b-a3a0-3f227be1b752', 0, '{"infraEnablers": {"section4_1": {"allEligible": "", "websiteLink": ""}, "section4_2": {"file": null, "available": ""}, "section4_3": {"file": null, "adopted": "", "marksObtained": 0, "numberOfProjects": ""}, "section4_4": {"file": null, "adopted": "", "marksObtained": 0}, "section4_5": {"file": null, "impact": "", "implemented": "", "practiceName": ""}, "section4_6": []}, "infraFinancing": {"section1_1": {"year": "2024-2025", "gsdpForFY": "250000", "percentage": 600, "stateCapex": "", "marksObtained": 50, "allocationToGSDP": "9", "capitalAllocation": "1500000", "capexToCapexActuals": "70", "stateCapexUtilisation": "1200000"}, "section1_2": {"year": "2025", "gsdpForFY": "145000", "percentage": 50.2, "actualCapex": "123000", "marksObtained": 25.1, "budgetaryCapex": "245000", "capexActualsToGSDP": "7", "stateCapexUtilisation": "332000"}, "section1_3": [{"id": "1760215297848", "ulb": "Mumbai Municipal Corporation", "rating": "A+", "cityName": "Mumbai", "ratingDate": "2025-10-22"}, {"id": "1760215320994", "ulb": "Nagpur Municipal Corporation", "rating": "A", "cityName": "New Delhi", "ratingDate": "2025-10-16"}], "section1_4": [{"id": "1760215337156", "value": "10000", "bondType": "Infrastructure bond", "cityName": "Pune", "issuingAuthority": "Development Authority"}], "section1_5": [{"id": "1760215057606", "website": "  \"status\": \"SUBMITTED_TO_STATE\"", "totalFunding": "1500", "yearEstablished": "2014", "organisationName": "GOV", "organisationType": "Development Authority"}]}, "pppDevelopment": {"section3_1": {"file": null, "available": "yes"}, "section3_2": {"file": null, "available": "no"}, "section3_3": [{"id": "bb5e32dc-4ee5-415e-a50a-b917703eaf25", "file": null, "type": "BOOT", "sector": "Water Supply", "projectName": "umag", "marksObtained": 5, "submissionDate": "2025-10-26"}], "section3_4": {"totalTPC": "1000", "proportion": 50, "marksObtained": 100, "tpcOfPPPProjects": "500"}}, "infraDevelopment": {"section2_1": [{"id": "9b178808-9b1f-4741-aa41-eeb34eb4ec26", "files": [{"id": "d9e60e49-5dbd-42c1-89d2-a6e00252a673", "file": {}, "fileName": "BRD-NIRI.docx", "fileSize": 129590, "uploadedAt": 1760215409278}], "sector": "Health"}], "section2_2": [{"id": "d319bfac-691f-47df-9a3a-7786cc5faac8", "files": [{"id": "fd4934cb-502c-44b0-a5fc-2355f131158f", "file": {}, "fileName": "BRD-NIRI.docx", "fileSize": 129590, "uploadedAt": 1760215416305}], "sector": "Water Supply"}], "section2_3": [{"id": "8aec36b8-9dbe-483f-9d4f-7ebcbcd987a2", "files": [{"id": "c13dd962-c1c3-45f9-a371-2b6f2d2feb67", "file": {}, "fileName": "BRD-NIRI.docx", "fileSize": 129590, "uploadedAt": 1760215422467}], "sector": "Sanitation"}], "section2_4": [{"id": "c59bd412-2034-441a-96e1-82d865f231a4", "dprFile": {"id": "7f7f4050-49e9-49ce-8e87-a5005c0672c4", "file": {}, "fileName": "BRD-NIRI.docx", "fileSize": 129590, "uploadedAt": 1760215430718}, "projectName": "gov"}], "section2_5": [{"id": "57ca8bcf-b62d-4aa9-aa7e-58c678fedb49", "type": "BOOT", "sector": "Water Supply", "ownership": "Revenue sharing", "projectName": "digi", "estimatedMonetization": "15000"}]}}', '[]', '{}', 'SUBMITTED_TO_STATE', 'STATE_APPROVER', '2025-10-13 12:26:48.224622', '2025-10-13 12:26:48.224622'),

('6c167494-3383-4054-8f50-124e80dfb35e', 'SUB-2025-589029', 'Gujarat', '554c8ac0-665a-488b-a3a0-3f227be1b752', 0, '{"infraEnablers": {"section4_1": {"allEligible": "", "websiteLink": ""}, "section4_2": {"file": null, "available": ""}, "section4_3": {"file": null, "adopted": "", "marksObtained": 0, "numberOfProjects": ""}, "section4_4": {"file": null, "adopted": "", "marksObtained": 0}, "section4_5": {"file": null, "impact": "", "implemented": "", "practiceName": ""}, "section4_6": []}, "infraFinancing": {"section1_1": {"year": "2024-2025", "gsdpForFY": "250000", "percentage": 600, "stateCapex": "", "marksObtained": 50, "allocationToGSDP": "9", "capitalAllocation": "1500000", "capexToCapexActuals": "70", "stateCapexUtilisation": "1200000"}, "section1_2": {"year": "2025", "gsdpForFY": "145000", "percentage": 50.2, "actualCapex": "123000", "marksObtained": 25.1, "budgetaryCapex": "245000", "capexActualsToGSDP": "7", "stateCapexUtilisation": "332000"}, "section1_3": [{"id": "1760215297848", "ulb": "Mumbai Municipal Corporation", "rating": "A+", "cityName": "Mumbai", "ratingDate": "2025-10-22"}, {"id": "1760215320994", "ulb": "Nagpur Municipal Corporation", "rating": "A", "cityName": "New Delhi", "ratingDate": "2025-10-16"}], "section1_4": [{"id": "1760215337156", "value": "10000", "bondType": "Infrastructure bond", "cityName": "Pune", "issuingAuthority": "Development Authority"}], "section1_5": [{"id": "1760215057606", "website": "  \"status\": \"SUBMITTED_TO_STATE\"", "totalFunding": "1500", "yearEstablished": "2014", "organisationName": "GOV", "organisationType": "Development Authority"}]}, "pppDevelopment": {"section3_1": {"file": null, "available": "yes"}, "section3_2": {"file": null, "available": "no"}, "section3_3": [{"id": "bb5e32dc-4ee5-415e-a50a-b917703eaf25", "file": null, "type": "BOOT", "sector": "Water Supply", "projectName": "umag", "marksObtained": 5, "submissionDate": "2025-10-26"}], "section3_4": {"totalTPC": "1000", "proportion": 50, "marksObtained": 100, "tpcOfPPPProjects": "500"}}, "infraDevelopment": {"section2_1": [{"id": "9b178808-9b1f-4741-aa41-eeb34eb4ec26", "files": [{"id": "d9e60e49-5dbd-42c1-89d2-a6e00252a673", "file": {}, "fileName": "BRD-NIRI.docx", "fileSize": 129590, "uploadedAt": 1760215409278}], "sector": "Health"}], "section2_2": [{"id": "d319bfac-691f-47df-9a3a-7786cc5faac8", "files": [{"id": "fd4934cb-502c-44b0-a5fc-2355f131158f", "file": {}, "fileName": "BRD-NIRI.docx", "fileSize": 129590, "uploadedAt": 1760215416305}], "sector": "Water Supply"}], "section2_3": [{"id": "8aec36b8-9dbe-483f-9d4f-7ebcbcd987a2", "files": [{"id": "c13dd962-c1c3-45f9-a371-2b6f2d2feb67", "file": {}, "fileName": "BRD-NIRI.docx", "fileSize": 129590, "uploadedAt": 1760215422467}], "sector": "Sanitation"}], "section2_4": [{"id": "c59bd412-2034-441a-96e1-82d865f231a4", "dprFile": {"id": "7f7f4050-49e9-49ce-8e87-a5005c0672c4", "file": {}, "fileName": "BRD-NIRI.docx", "fileSize": 129590, "uploadedAt": 1760215430718}, "projectName": "gov"}], "section2_5": [{"id": "57ca8bcf-b62d-4aa9-aa7e-58c678fedb49", "type": "BOOT", "sector": "Water Supply", "ownership": "Revenue sharing", "projectName": "digi", "estimatedMonetization": "15000"}]}}', '[{"role": "STATE_APPROVER", "text": "Forwarding to MoSPI Reviewer for review", "type": "comment", "userId": "04769e33-139d-4dc9-91cc-0696e4d52aa9", "timestamp": "2025-10-13T07:03:36.062Z"}]', '{}', 'SUBMITTED_TO_MOSPI_REVIEWER', 'MOSPI_REVIEWER', '2025-10-13 12:26:29.134638', '2025-10-13 12:33:36.092019'),

('234e4b1e-c81a-485e-a4fd-f26f5f23bc09', 'SUB-2025-598296', 'Gujarat', '554c8ac0-665a-488b-a3a0-3f227be1b752', 0, '{"infraEnablers": {"section4_1": {"allEligible": "", "websiteLink": ""}, "section4_2": {"file": null, "available": ""}, "section4_3": {"file": null, "adopted": "", "marksObtained": 0, "numberOfProjects": ""}, "section4_4": {"file": null, "adopted": "", "marksObtained": 0}, "section4_5": {"file": null, "impact": "", "implemented": "", "practiceName": ""}, "section4_6": []}, "infraFinancing": {"section1_1": {"year": "2024-2025", "gsdpForFY": "250000", "percentage": 600, "stateCapex": "", "marksObtained": 50, "allocationToGSDP": "9", "capitalAllocation": "1500000", "capexToCapexActuals": "70", "stateCapexUtilisation": "1200000"}, "section1_2": {"year": "2025", "gsdpForFY": "145000", "percentage": 50.2, "actualCapex": "123000", "marksObtained": 25.1, "budgetaryCapex": "245000", "capexActualsToGSDP": "7", "stateCapexUtilisation": "332000"}, "section1_3": [{"id": "1760215297848", "ulb": "Mumbai Municipal Corporation", "rating": "A+", "cityName": "Mumbai", "ratingDate": "2025-10-22"}, {"id": "1760215320994", "ulb": "Nagpur Municipal Corporation", "rating": "A", "cityName": "New Delhi", "ratingDate": "2025-10-16"}], "section1_4": [{"id": "1760215337156", "value": "10000", "bondType": "Infrastructure bond", "cityName": "Pune", "issuingAuthority": "Development Authority"}], "section1_5": [{"id": "1760215057606", "website": "  \"status\": \"SUBMITTED_TO_STATE\"", "totalFunding": "1500", "yearEstablished": "2014", "organisationName": "GOV", "organisationType": "Development Authority"}]}, "pppDevelopment": {"section3_1": {"file": null, "available": "yes"}, "section3_2": {"file": null, "available": "no"}, "section3_3": [{"id": "bb5e32dc-4ee5-415e-a50a-b917703eaf25", "file": null, "type": "BOOT", "sector": "Water Supply", "projectName": "umag", "marksObtained": 5, "submissionDate": "2025-10-26"}], "section3_4": {"totalTPC": "1000", "proportion": 50, "marksObtained": 100, "tpcOfPPPProjects": "500"}}, "infraDevelopment": {"section2_1": [{"id": "9b178808-9b1f-4741-aa41-eeb34eb4ec26", "files": [{"id": "d9e60e49-5dbd-42c1-89d2-a6e00252a673", "file": {}, "fileName": "BRD-NIRI.docx", "fileSize": 129590, "uploadedAt": 1760215409278}], "sector": "Health"}], "section2_2": [{"id": "d319bfac-691f-47df-9a3a-7786cc5faac8", "files": [{"id": "fd4934cb-502c-44b0-a5fc-2355f131158f", "file": {}, "fileName": "BRD-NIRI.docx", "fileSize": 129590, "uploadedAt": 1760215416305}], "sector": "Water Supply"}], "section2_3": [{"id": "8aec36b8-9dbe-483f-9d4f-7ebcbcd987a2", "files": [{"id": "c13dd962-c1c3-45f9-a371-2b6f2d2feb67", "file": {}, "fileName": "BRD-NIRI.docx", "fileSize": 129590, "uploadedAt": 1760215422467}], "sector": "Sanitation"}], "section2_4": [{"id": "c59bd412-2034-441a-96e1-82d865f231a4", "dprFile": {"id": "7f7f4050-49e9-49ce-8e87-a5005c0672c4", "file": {}, "fileName": "BRD-NIRI.docx", "fileSize": 129590, "uploadedAt": 1760215430718}, "projectName": "gov"}], "section2_5": [{"id": "57ca8bcf-b62d-4aa9-aa7e-58c678fedb49", "type": "BOOT", "sector": "Water Supply", "ownership": "Revenue sharing", "projectName": "digi", "estimatedMonetization": "15000"}]}}', '[{"role": "STATE_APPROVER", "text": "Forwarding to MoSPI Reviewer for review", "type": "comment", "userId": "04769e33-139d-4dc9-91cc-0696e4d52aa9", "timestamp": "2025-10-13T07:03:43.157Z"}, {"role": "MOSPI_REVIEWER", "text": "Reviewed and approved, forwarding to MoSPI Approver for final approval", "type": "comment", "userId": "714ad9a5-77c2-46e4-b7ab-56ca2afa203e", "timestamp": "2025-10-13T07:04:16.415Z"}]', '{}', 'SUBMITTED_TO_MOSPI_APPROVER', 'MOSPI_APPROVER', '2025-10-13 12:26:38.330874', '2025-10-13 12:34:16.416073');

-- ==========================================
-- VERIFICATION QUERIES
-- ==========================================
SELECT 'Database Setup Completed Successfully!' as status;

SELECT 'Tables Created:' as info;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

SELECT 'Record Counts:' as info;
SELECT 'Users:' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'Submissions:' as table_name, COUNT(*) as count FROM submissions
UNION ALL
SELECT 'Final Scores:' as table_name, COUNT(*) as count FROM final_scores
UNION ALL
SELECT 'Audit Logs:' as table_name, COUNT(*) as count FROM audit_logs;

-- ==========================================
-- DATABASE SUMMARY
-- ==========================================
SELECT '=== NIRI COMPLETE DATABASE SUMMARY ===' as title;
SELECT 'Export Date: 2025-10-13' as export_date;
SELECT 'Database: niri_backend' as database_name;
SELECT 'Users: 10' as user_count;
SELECT 'Submissions: 4' as submission_count;
SELECT 'Final Scores: 0' as score_count;
SELECT 'Audit Logs: 0' as audit_count;
SELECT 'Status: Complete with all data' as status;

-- ==========================================
-- USAGE INSTRUCTIONS
-- ==========================================
SELECT '=== USAGE INSTRUCTIONS ===' as title;
SELECT '1. Run this script on your new PostgreSQL database' as instruction;
SELECT '2. All tables, indexes, and data will be created' as instruction;
SELECT '3. Update your application database connection settings' as instruction;
SELECT '4. Test the application with the imported data' as instruction;
SELECT '5. All user passwords are hashed and ready to use' as instruction;
