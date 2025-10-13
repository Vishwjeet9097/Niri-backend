# 🚀 NIRI Backend - Database Migration & User Setup Guide

## 📋 Overview
This guide covers how to migrate the database and set up default users for the NIRI Backend API in production.

## 🔧 Prerequisites
- Node.js (v18+)
- PostgreSQL database (local or AWS RDS)
- Environment variables configured
- AWS CLI (for AWS RDS)

## 📊 Database Migration Methods

### Method 1: Automatic Migration (Recommended)
```bash
# Set environment variables
export NODE_ENV=production
export DB_HOST=your-database-host
export DB_PORT=5432
export DB_USERNAME=your-username
export DB_PASSWORD=your-password
export DB_DATABASE=your-database-name
export DB_SSL=require

# Run migration (creates tables + users automatically)
npm run migration:run
```

### Method 2: AWS RDS Migration
```bash
# 1. Configure AWS CLI
aws configure

# 2. Get RDS endpoint
aws rds describe-db-instances --query 'DBInstances[*].[DBInstanceIdentifier,Endpoint.Address,Endpoint.Port]' --output table

# 3. Set environment variables
export DB_HOST=your-rds-endpoint.amazonaws.com
export DB_PORT=5432
export DB_USERNAME=your-rds-username
export DB_PASSWORD=your-rds-password
export DB_DATABASE=your-database-name
export DB_SSL=require

# 4. Run migration
npm run migration:run
```

### Method 3: Direct Database Connection
```bash
# Connect to database
psql "postgresql://username:password@host:port/database_name?sslmode=require"

# Run SQL commands manually (see SQL Commands section below)
```

## 🗄️ SQL Commands (Manual Setup)

### 1. Create Tables
```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR UNIQUE NOT NULL,
  password VARCHAR NOT NULL,
  "firstName" VARCHAR NOT NULL,
  "lastName" VARCHAR NOT NULL,
  role VARCHAR NOT NULL CHECK (role IN ('NODAL_OFFICER', 'STATE_APPROVER', 'MOSPI_REVIEWER', 'MOSPI_APPROVER')),
  "stateUt" VARCHAR NOT NULL,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Create submissions table
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "submissionId" VARCHAR UNIQUE NOT NULL,
  "formData" JSONB NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'DRAFT',
  "ownerId" UUID REFERENCES users(id),
  "stateUt" VARCHAR NOT NULL,
  "rejectionComment" TEXT,
  "filePaths" TEXT[],
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Create audit_logs table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "entityType" VARCHAR NOT NULL,
  "entityId" UUID NOT NULL,
  "action" VARCHAR NOT NULL,
  "userId" UUID REFERENCES users(id),
  "oldValues" JSONB,
  "newValues" JSONB,
  "timestamp" TIMESTAMP DEFAULT NOW()
);

-- Create final_scores table
CREATE TABLE final_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "submissionId" UUID REFERENCES submissions(id),
  "totalScore" DECIMAL(10,2),
  "rank" INTEGER,
  "stateUt" VARCHAR NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IDX_users_email ON users (email);
CREATE INDEX IDX_users_state_ut_role ON users ("stateUt", role);
CREATE INDEX IDX_submissions_status ON submissions (status);
CREATE INDEX IDX_submissions_state_ut ON submissions ("stateUt");
CREATE INDEX IDX_audit_logs_entity ON audit_logs ("entityType", "entityId");
```

### 2. Insert Default Users
```sql
-- Insert 4 default users with hashed passwords
INSERT INTO users (id, email, password, "firstName", "lastName", role, "stateUt", "isActive") VALUES
('11111111-1111-1111-1111-111111111111', 'nodal@niri.gov.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K', 'Nodal', 'Officer', 'NODAL_OFFICER', 'Maharashtra', true),
('22222222-2222-2222-2222-222222222222', 'state@niri.gov.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K', 'State', 'Approver', 'STATE_APPROVER', 'Maharashtra', true),
('33333333-3333-3333-3333-333333333333', 'mospi.reviewer@niri.gov.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K', 'MoSPI', 'Reviewer', 'MOSPI_REVIEWER', 'Central', true),
('44444444-4444-4444-4444-444444444444', 'mospi.approver@niri.gov.in', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K', 'MoSPI', 'Approver', 'MOSPI_APPROVER', 'Central', true);
```

## 👥 Default Users Created

| Email | Password | Role | State/UT | Purpose |
|-------|----------|------|----------|---------|
| nodal@niri.gov.in | password123 | NODAL_OFFICER | Maharashtra | State Nodal Officer |
| state@niri.gov.in | password123 | STATE_APPROVER | Maharashtra | State Approver |
| mospi.reviewer@niri.gov.in | password123 | MOSPI_REVIEWER | Central | MoSPI Reviewer |
| mospi.approver@niri.gov.in | password123 | MOSPI_APPROVER | Central | MoSPI Approver |

## 🔍 Verification Steps

### 1. Check Database Connection
```bash
curl http://your-domain/health
```

### 2. Test User Login
```bash
# Test Nodal Officer login
curl -X POST http://your-domain/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nodal@niri.gov.in","password":"password123"}'

# Test State Approver login
curl -X POST http://your-domain/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"state@niri.gov.in","password":"password123"}'
```

### 3. Check Database Tables
```sql
-- Check if tables exist
\dt

-- Check user count
SELECT COUNT(*) FROM users;

-- Check specific users
SELECT email, role, "stateUt" FROM users;
```

## 🚨 Troubleshooting

### Common Issues:

1. **SSL Connection Error**
   ```bash
   # Solution: Set DB_SSL=require
   export DB_SSL=require
   ```

2. **Table Already Exists**
   ```bash
   # Solution: Check existing tables first
   \dt
   ```

3. **Migration Already Run**
   ```bash
   # Solution: Check migration status
   npm run migration:show
   ```

4. **User Already Exists**
   ```sql
   -- Solution: Check existing users
   SELECT email FROM users WHERE email LIKE '%@niri.gov.in';
   ```

## 📝 Environment Variables

Create `.env` file in production:
```env
NODE_ENV=production
DB_HOST=your-database-host
DB_PORT=5432
DB_USERNAME=your-username
DB_PASSWORD=your-password
DB_DATABASE=your-database-name
DB_SSL=require
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=24h
```

## 🎯 Quick Start Commands

```bash
# 1. Clone repository
git clone <repository-url>
cd niri-backend

# 2. Install dependencies
npm install

# 3. Set environment variables
export NODE_ENV=production
export DB_HOST=your-host
export DB_PORT=5432
export DB_USERNAME=your-username
export DB_PASSWORD=your-password
export DB_DATABASE=your-database
export DB_SSL=require

# 4. Run migration (creates tables + users)
npm run migration:run

# 5. Start application
npm run start:prod
```

## ✅ Success Indicators

- ✅ Database connection successful
- ✅ All 4 tables created
- ✅ 4 default users created
- ✅ Login working for all users
- ✅ Application running on port 3000

## 📞 Support

If you encounter any issues:
1. Check the logs: `npm run start:dev`
2. Verify environment variables
3. Test database connection manually
4. Check migration status: `npm run migration:show`
