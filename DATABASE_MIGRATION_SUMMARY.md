# NIRI Scoring System - Database Migration Summary

## 📋 Overview
This document summarizes all database changes required for the NIRI Scoring System implementation.

## 🗄️ Database Changes Required

### 1. **Final Scores Table** (`final_scores`)
**Purpose:** Store calculated scores with detailed breakdown

**New Columns Added:**
- `category_scores` (jsonb) - Scores for each category (Infra Financing, Development, PPP, Enablers)
- `scoring_version` (varchar) - Version of scoring methodology (1.0 for old, 2.0 for new)

**Existing Columns:**
- `id` (uuid, primary key)
- `submission_id` (uuid, unique, foreign key to submissions)
- `state_ut` (varchar) - State/UT name
- `total_score` (decimal) - Total calculated score
- `score_breakdown` (jsonb) - Detailed breakdown of all indicators
- `calculation_methodology` (text) - Methodology description
- `approved_by` (varchar) - User who approved the score
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

**Indexes:**
- `IDX_final_scores_state_ut` - For state-based queries
- `IDX_final_scores_total_score` - For ranking queries
- `IDX_final_scores_created_at` - For time-based queries
- `IDX_final_scores_scoring_version` - For version-based queries

### 2. **Submission Status Enum Updates**
**Purpose:** Support complete workflow with proper status transitions

**New Status Values Added:**
- `DRAFT` - Initial draft state
- `SUBMITTED_TO_MOSPI_REVIEWER` - Submitted to MoSPI for review
- `SUBMITTED_TO_MOSPI_APPROVER` - Forwarded to MoSPI for approval
- `REJECTED` - Rejected by any authority
- `REJECTED_FINAL` - Finally rejected
- `RETURNED_FROM_STATE` - Returned from state level
- `RETURNED_FROM_MOSPI` - Returned from MoSPI level

**Existing Status Values:**
- `SUBMITTED_TO_STATE` - Submitted to state level
- `APPROVED` - Finally approved

### 3. **Data Migration**
**Purpose:** Update existing data to match new schema

**Changes Made:**
- Update `SUBMITTED_TO_MOSPI` → `SUBMITTED_TO_MOSPI_REVIEWER`
- Set `scoring_version` to '1.0' for existing records
- Set NULL/empty status values to 'DRAFT'

## 📁 Migration Files

### 1. **1700000000003-CreateFinalScoresTable.ts**
- Creates the `final_scores` table
- Sets up basic structure and indexes
- Establishes foreign key relationship

### 2. **1700000000005-UpdateFinalScoresForNewScoring.ts**
- Adds `category_scores` column
- Adds `scoring_version` column
- Creates version index
- Updates existing data

### 3. **1700000000006-UpdateSubmissionStatusEnum.ts**
- Adds new status enum values
- Updates existing data
- Handles enum value conflicts

## 🚀 Setup Instructions

### Option 1: Using TypeORM Migrations
```bash
# Run all migrations
npm run migration:run

# Or run specific migration
npm run migration:run -- --name=UpdateFinalScoresForNewScoring
```

### Option 2: Using SQL Script
```bash
# Run the comprehensive setup script
psql -d your_database_name -f database-setup-for-scoring.sql
```

### Option 3: Manual Setup
1. Run each migration file individually
2. Verify data integrity
3. Test scoring functionality

## 🔍 Verification Queries

### Check Final Scores Table
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'final_scores' 
ORDER BY ordinal_position;
```

### Check Status Enum Values
```sql
SELECT enumlabel as enum_value 
FROM pg_enum 
WHERE enumtypid = (
    SELECT oid 
    FROM pg_type 
    WHERE typname = 'submissions_status_enum'
)
ORDER BY enumlabel;
```

### Check Data Distribution
```sql
SELECT status, COUNT(*) as count 
FROM submissions 
GROUP BY status 
ORDER BY status;
```

## ⚠️ Important Notes

### 1. **Backup Before Migration**
- Always backup your database before running migrations
- Test migrations on a copy of production data first

### 2. **Enum Value Addition**
- PostgreSQL requires adding enum values one by one
- Cannot remove enum values easily (requires recreating enum type)

### 3. **Data Integrity**
- Foreign key constraints ensure data consistency
- All existing data is preserved and updated appropriately

### 4. **Performance Considerations**
- Indexes are created for optimal query performance
- JSONB columns support efficient JSON operations

## 🎯 Post-Migration Checklist

- [ ] Verify `final_scores` table exists with all columns
- [ ] Check all status enum values are available
- [ ] Confirm existing data is properly updated
- [ ] Test scoring calculation functionality
- [ ] Verify API endpoints work correctly
- [ ] Check database performance with new indexes

## 🔧 Troubleshooting

### Common Issues:
1. **Enum value conflicts** - Run enum migration step by step
2. **Foreign key errors** - Ensure submissions table exists first
3. **Permission errors** - Run as database superuser
4. **Data type mismatches** - Check column definitions

### Rollback Instructions:
- Use `npm run migration:revert` for TypeORM migrations
- Manual rollback requires dropping new columns and enum values

## 📊 Database Schema Diagram

```
submissions (1) ←→ (1) final_scores
     ↓
   users (1) ←→ (n) submissions
```

**Relationships:**
- `submissions.submitted_by` → `users.id`
- `final_scores.submission_id` → `submissions.id`

## ✅ Success Indicators

After successful migration, you should see:
- ✅ `final_scores` table with all required columns
- ✅ All 9 status enum values available
- ✅ Existing data properly migrated
- ✅ All indexes created successfully
- ✅ Foreign key constraints established
- ✅ Scoring APIs working correctly

**The NIRI Scoring System database is now ready for production use!** 🚀
