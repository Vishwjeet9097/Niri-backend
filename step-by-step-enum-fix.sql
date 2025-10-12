-- Step-by-Step Enum Fix Commands
-- Run these commands ONE BY ONE in psql

-- Command 1: Check current enum
SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'submissions_status_enum') ORDER BY enumlabel;

-- Command 2: Add first enum value
ALTER TYPE submissions_status_enum ADD VALUE 'SUBMITTED_TO_MOSPI_REVIEWER';

-- Command 3: Add second enum value  
ALTER TYPE submissions_status_enum ADD VALUE 'SUBMITTED_TO_MOSPI_APPROVER';

-- Command 4: Verify enum values
SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'submissions_status_enum') ORDER BY enumlabel;

-- Command 5: Update data
UPDATE submissions SET status = 'SUBMITTED_TO_MOSPI_REVIEWER' WHERE status = 'SUBMITTED_TO_MOSPI';

-- Command 6: Verify update
SELECT status, COUNT(*) FROM submissions GROUP BY status ORDER BY status;
