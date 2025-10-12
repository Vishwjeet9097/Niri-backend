# 🧪 NIRI Backend - Complete Testing Guide

## 📋 Overview

यह guide आपको NIRI Backend API के सभी tests को run करने में help करेगा। हमने comprehensive test suite बनाया है जो सभी endpoints, workflows, और features को test करता है।

## 🚀 Quick Start

### Complete Test Suite

```bash
# Run all tests (recommended)
npm run test:complete

# Or run individual test suites
npm run test:auth
npm run test:submissions
npm run test:users
npm run test:dashboard
```

## 📊 Test Categories

### 1. **Authentication Tests** (`test/auth.e2e-spec.ts`)

- ✅ User registration
- ✅ User login
- ✅ Profile management
- ✅ Password change
- ✅ JWT token validation
- ✅ Role-based access

### 2. **Submission Workflow Tests** (`test/submission.e2e-spec.ts`)

- ✅ Create submission
- ✅ 4-tier workflow (Nodal → State → MoSPI Review → MoSPI Approve)
- ✅ Status transitions
- ✅ Rejection handling
- ✅ Resubmission logic
- ✅ Comment system
- ✅ File upload integration

### 3. **User Management Tests** (`test/user.e2e-spec.ts`)

- ✅ User CRUD operations
- ✅ Role-based filtering
- ✅ State-wise filtering
- ✅ User updates
- ✅ User deactivation
- ✅ Access control

### 4. **Dashboard Tests** (`test/dashboard.e2e-spec.ts`)

- ✅ Role-specific dashboards
- ✅ KPI metrics
- ✅ Performance metrics
- ✅ State-specific data
- ✅ National-level data

### 5. **Complete Workflow Tests** (`test/app.e2e-spec.ts`)

- ✅ End-to-end workflow
- ✅ File management
- ✅ Single rejection rule
- ✅ Role-based access control
- ✅ Database operations

## 🔧 Test Commands

### Individual Test Suites

```bash
# Authentication tests
npm run test:auth

# Submission workflow tests
npm run test:submissions

# User management tests
npm run test:users

# Dashboard tests
npm run test:dashboard

# All E2E tests
npm run test:e2e

# Unit tests
npm run test

# All tests (unit + E2E)
npm run test:all
```

### Complete Test Suite

```bash
# Run complete test suite with detailed reporting
npm run test:complete
```

## 🗄️ Test Database Setup

### Automatic Setup

Tests automatically create and manage test database:

- **Database**: `niri_test_db`
- **User**: `postgres`
- **Password**: `postgres123`
- **Host**: `localhost`
- **Port**: `5432`

### Manual Setup (if needed)

```bash
# Create test database
createdb niri_test_db

# Set password for postgres user
psql -U postgres -c "ALTER USER postgres PASSWORD 'postgres123';"
```

## 📝 Test Data

### Test Users Created

- **Nodal Officer**: `nodal@test.com` (Maharashtra)
- **State Approver**: `state@test.com` (Maharashtra)
- **MoSPI Reviewer**: `mospi.reviewer@test.com` (Central)
- **MoSPI Approver**: `mospi.approver@test.com` (Central)

### Test Submissions

- Multiple submissions with different statuses
- Realistic form data
- File attachments
- Comments and reviews

## 🎯 Test Scenarios

### Authentication Flow

1. **Registration**: Create users with all roles
2. **Login**: Valid/invalid credentials
3. **Profile**: Get user profile
4. **Password Change**: Update password
5. **Token Validation**: JWT token verification

### Submission Workflow

1. **Create**: Nodal Officer creates submission
2. **Submit to State**: Forward to State Approver
3. **State Review**: Approve/reject at state level
4. **Forward to MoSPI**: Send to MoSPI Reviewer
5. **MoSPI Review**: Add comments and review
6. **Final Approval**: MoSPI Approver approves
7. **Scoring**: Automatic score calculation

### User Management

1. **List Users**: Get all users with pagination
2. **Filter by Role**: Filter users by role
3. **Filter by State**: Filter users by state
4. **Update User**: Modify user details
5. **Deactivate User**: Soft delete user

### Dashboard & Reports

1. **Role-specific Dashboards**: Different views for each role
2. **KPI Metrics**: Performance indicators
3. **State Data**: State-specific information
4. **National Data**: Country-wide statistics

## 🔍 Test Results

### Success Indicators

- ✅ All tests pass
- ✅ Database operations successful
- ✅ API endpoints responding
- ✅ Authentication working
- ✅ Workflow functioning
- ✅ File management working

### Common Issues & Solutions

#### Database Connection Failed

```bash
# Start PostgreSQL
brew services start postgresql

# Check connection
pg_isready
```

#### Port Already in Use

```bash
# Kill process on port 3000
kill -9 $(lsof -ti:3000)
```

#### Test Database Issues

```bash
# Drop and recreate test database
dropdb niri_test_db
createdb niri_test_db
```

#### Dependencies Issues

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

## 📊 Test Coverage

### Endpoints Tested

- **Authentication**: 5 endpoints
- **Submissions**: 8 endpoints
- **Users**: 6 endpoints
- **Dashboard**: 2 endpoints
- **Files**: 4 endpoints
- **Reports**: 4 endpoints
- **Audit**: 4 endpoints

### Total Test Cases

- **Unit Tests**: 20+ test cases
- **E2E Tests**: 50+ test cases
- **Integration Tests**: 30+ test cases
- **Total**: 100+ test cases

## 🚀 Running Tests in CI/CD

### GitHub Actions Example

```yaml
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: postgres123
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test:complete
```

## 📈 Performance Testing

### Load Testing

```bash
# Install artillery for load testing
npm install -g artillery

# Run load tests
artillery run load-test.yml
```

### Memory Testing

```bash
# Run with memory profiling
node --inspect-brk node_modules/.bin/jest --runInBand
```

## 🐛 Debugging Tests

### Debug Mode

```bash
# Run tests in debug mode
npm run test:debug

# Run specific test file
npm run test:e2e -- --testPathPattern=auth.e2e-spec.ts --verbose
```

### Verbose Output

```bash
# Run with detailed output
npm run test:e2e -- --verbose --detectOpenHandles
```

## 📋 Test Checklist

Before running tests, ensure:

- [ ] PostgreSQL is running
- [ ] Test database exists
- [ ] Dependencies are installed
- [ ] Environment variables are set
- [ ] No other services on port 3000
- [ ] Sufficient disk space
- [ ] Network connectivity

## 🎉 Success Criteria

Tests are considered successful when:

- ✅ All test suites pass
- ✅ No critical errors
- ✅ Database operations complete
- ✅ API responses are correct
- ✅ Workflow functions properly
- ✅ File operations work
- ✅ Authentication is secure
- ✅ Role-based access is enforced

## 📞 Support

If tests fail:

1. Check the error messages
2. Verify database connection
3. Check environment variables
4. Review the test logs
5. Ensure all dependencies are installed
6. Check for port conflicts

---

**🎯 Ready to test your NIRI Backend API!**

Run `npm run test:complete` to start comprehensive testing.
