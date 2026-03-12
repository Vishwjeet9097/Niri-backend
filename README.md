# National Infrastructure Readiness Index (NIRI) Backend API

## #📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [File Storage](#file-storage)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
  
## 🎯 Overview

National Infrastructure Readiness Index (NIRI) Backend API एक comprehensive system है जो infrastructure readiness assessment के लिए designed किया गया है। यह system 4-tier workflow के साथ complete file management capabilities provide करता है।

### Key Features:

- **4-Tier Workflow**: Nodal Officer → State Approver → MoSPI Reviewer → MoSPI Approver
- **File Management**: Local और AWS S3 storage support
- **Transaction Safety**: ACID compliance with rollback mechanisms
- **Audit Trail**: Complete operation logging
- **Role-Based Access**: Secure authorization system
- **Scoring Engine**: Dynamic score calculation
- **Dashboard & Reports**: Comprehensive analytics

## 🚀 Features

### Authentication & Authorization

- JWT-based authentication
- Role-based access control (RBAC)
- Secure password hashing
- User profile management

### Submission Workflow

- **Nodal Officer**: Create submissions, upload files, resubmit
- **State Approver**: Review, forward to MoSPI, or reject
- **MoSPI Reviewer**: Review submissions, add comments
- **MoSPI Approver**: Final approval or rejection with single-rejection rule

### File Management

- **Dual Storage**: Local filesystem और AWS S3
- **File Upload**: Single और multiple file uploads
- **File Validation**: Size limits (50MB), MIME type validation
- **File Organization**: Structured folder management
- **File Security**: Role-based access control

### Transaction Safety

- **ACID Compliance**: All critical operations atomic
- **Rollback Mechanisms**: Proper rollback on failures
- **Error Recovery**: Graceful failure handling
- **Stability Features**: Crash prevention

### Audit & Compliance

- **Complete Audit Trail**: All operations logged
- **Entity Tracking**: Track changes to submissions
- **User Activity**: Monitor user actions
- **Compliance Reports**: Generate audit reports

### Scoring & Analytics

- **Dynamic Scoring**: PostgreSQL JSONB operators
- **Dashboard KPIs**: Role-specific metrics
- **Ranking System**: National ranking table
- **Export Options**: JSON और CSV export

## 🛠 Tech Stack

- **Framework**: NestJS
- **Database**: PostgreSQL
- **ORM**: TypeORM
- **Authentication**: JWT (Passport)
- **File Storage**: Local filesystem + AWS S3
- **Validation**: class-validator
- **Testing**: Jest + Supertest
- **Containerization**: Docker
- **Audit**: nestjs-cls

## 📋 Prerequisites

- Node.js (v18+)
- PostgreSQL (v13+)
- npm या yarn
- AWS Account (S3 storage के लिए, optional)

## 🔧 Installation

### 1. Clone Repository

```bash
git clone <repository-url>
cd niri_dev-backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

```bash
cp env.example .env
```

### 4. Database Setup

```bash
# Create PostgreSQL database
createdb niri_db

# Run migrations
npm run migration:run
```

### 5. Start Application

```bash
# Development mode
npm run start:dev

# Production mode
npm run start:prod
```

## ⚙️ Configuration

### Environment Variables

#### Database Configuration

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_NAME=niri_db
DB_SYNCHRONIZE=false
DB_LOGGING=true
```

#### JWT Configuration

```env
# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h
```

#### File Storage Configuration

```env
# File Storage (NFS - default for NIRI)
# Ensure /neibackend NFS mount is available before starting
STORAGE_TYPE=local
STORAGE_PATH_LOCAL=/neibackend

# File Storage (AWS S3 - alternative)
STORAGE_TYPE=s3
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
S3_REGION=us-east-1
S3_BUCKET_NAME=your-s3-bucket-name
```

#### Application Configuration

```env
# Application
PORT=3000
NODE_ENV=development
```

## 🗄️ Database Setup

### 1. Create Database

```sql
CREATE DATABASE niri_db;
```

### 2. Run Migrations

```bash
npm run migration:run
```

### 3. Verify Tables

```sql
\dt
```

### Database Schema

- **users**: User management
- **submissions**: Submission data with file attachments
- **audit_logs**: Complete audit trail
- **final_scores**: Calculated scores

## 🚀 Running the Application

### Development Mode

```bash
npm run start:dev
```

### Production Mode

```bash
npm run build
npm run start:prod
```

### Docker

```bash
# Build image
docker build -t niri_dev-backend .

# Run container
docker run -p 3000:3000 niri_dev-backend
```

### Docker Compose

```bash
docker-compose up -d
```

## 📚 API Documentation

### Base URL

```
http://localhost:3000
```

### Authentication Endpoints

```
POST /auth/register     - User registration
POST /auth/login        - User login
GET  /auth/profile      - Get user profile
PUT  /auth/change-password - Change password
```

### File Storage Endpoints

```
POST /file/upload/:submissionId           - Upload single file
POST /file/upload-multiple/:submissionId   - Upload multiple files
GET  /file/url/:filePath                  - Get file URL
DELETE /file/:filePath                    - Delete file
GET  /file/storage-info                   - Get storage information
```

### Submission Endpoints

```
POST   /submission                        - Create submission
GET    /submission                        - Get all submissions
GET    /submission/:id                    - Get submission by ID
PATCH  /submission/:id                    - Update submission
POST   /submission/:id/comment            - Add comment
POST   /submission/forward-to-mospi/:id   - Forward to MoSPI
POST   /submission/state-reject/:id      - State rejection
POST   /submission/final-reject/:id      - Final rejection
POST   /submission/resubmit/:id          - Resubmit
POST   /submission/approve/:id           - Approve submission
```

### Dashboard Endpoints

```
GET /dashboard/summary  - Get dashboard summary
GET /dashboard/kpis     - Get role-specific KPIs
```

### Report Endpoints

```
GET /report/ranking           - Get rankings
GET /report/full-report       - Get full report
GET /report/state/:stateUt    - Get state report
GET /report/export            - Export rankings
GET /report/submission-status - Get submission status report
```

### Audit Endpoints

```
GET /audit                    - Get all audit logs
GET /audit/entity/:entity/:id - Get entity audit trail
GET /audit/user/:userId       - Get user audit logs
GET /audit/stats              - Get audit statistics
GET /audit/my-activity        - Get my activity
```

## 🧪 Testing

### Unit Tests

```bash
npm run test
```

### E2E Tests

```bash
npm run test:e2e
```

### Test Coverage

```bash
npm run test:cov
```

### Test Files

- `src/modules/auth/auth.service.spec.ts`
- `src/modules/submission/submission.service.spec.ts`
- `src/modules/storage/storage.service.spec.ts`
- `test/app.e2e-spec.ts`

## 📁 File Storage

### NFS Storage (Default for NIRI)

- Files stored at NFS mount path `/neibackend`
- Organized by submission ID: `submissions/[submission_id]/`
- Unique filenames with UUID
- Ensure NFS is mounted at `/neibackend` before starting the backend

### AWS S3 Storage (Alternative)

- Files uploaded to configured S3 bucket
- Organized in `submissions/[submission_id]/` structure
- Pre-signed URLs for secure access

### File Operations

- **Upload**: Single और multiple file uploads
- **Download**: Secure URL generation
- **Delete**: File removal with cleanup
- **Validation**: Size और type validation

## 🚀 Deployment

### Production Environment

```bash
# Build application
npm run build

# Start production server
npm run start:prod
```

### Environment Variables for Production

```env
NODE_ENV=production
PORT=3000
DB_HOST=your-production-db-host
DB_PASSWORD=your-production-password
JWT_SECRET=your-production-jwt-secret

# NFS Storage (default for NIRI)
STORAGE_TYPE=local
STORAGE_PATH_LOCAL=/neibackend

# Or AWS S3 (alternative)
# STORAGE_TYPE=s3
# AWS_ACCESS_KEY_ID=your-production-aws-key
# AWS_SECRET_ACCESS_KEY=your-production-aws-secret
# S3_BUCKET_NAME=your-production-bucket
```

### Docker Deployment

```bash
# Build production image
docker build -t niri_dev-backend:latest .

# Run with NFS volume mount (ensure /neibackend is mounted on host)
docker run -d \
  -p 3000:3000 \
  -v /neibackend:/neibackend \
  -e NODE_ENV=production \
  -e DB_HOST=your-db-host \
  -e DB_PASSWORD=your-password \
  -e STORAGE_TYPE=local \
  -e STORAGE_PATH_LOCAL=/neibackend \
  niri_dev-backend:latest
```

## 🔧 Troubleshooting

### Common Issues

#### Database Connection Error

```bash
# Check PostgreSQL service
sudo service postgresql status

# Check database exists
psql -l | grep niri_db
```

#### File Upload Issues

```bash
# Check NFS mount and directory permissions
ls -la /neibackend

# Ensure NFS is mounted (if using NFS)
mount | grep neibackend

# Check AWS credentials (if using S3)
aws s3 ls
```

#### JWT Token Issues

```bash
# Check JWT_SECRET in .env
echo $JWT_SECRET
```

### Logs

```bash
# Application logs
npm run start:dev

# Docker logs
docker logs <container-id>
```

### Performance Issues

- Check database indexes
- Monitor file storage usage
- Review query performance
- Check memory usage

## 📊 Monitoring

### Health Check

```bash
curl http://localhost:3000/health
```

### Metrics

- Database connection status
- File storage status
- JWT token validation
- API response times

## 🔒 Security

### Best Practices

- Use strong JWT secrets
- Enable HTTPS in production
- Regular security updates
- Monitor audit logs
- File upload validation
- Role-based access control

### Environment Security

- Never commit `.env` files
- Use environment-specific secrets
- Regular credential rotation
- Secure database access

## 📞 Support

### Documentation

- API documentation in Postman collection
- Code comments for complex logic
- README updates for new features

### Contact

- Technical issues: Check logs first
- Feature requests: Create issue
- Security concerns: Report immediately

## 🎉 Success!

आपका NIRI Backend API system successfully configured और ready है!

**Next Steps:**

1. Import Postman collection
2. Configure environment variables
3. Run database migrations
4. Start the application
5. Test all endpoints

**Happy Coding!** 🚀
