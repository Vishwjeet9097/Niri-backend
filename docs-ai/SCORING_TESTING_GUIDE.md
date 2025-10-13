# NIRI Scoring System Testing Guide

## 🧪 Complete Testing Guide for NIRI Scoring System

### Prerequisites
1. **Server Running**: Ensure NIRI backend is running on `http://localhost:3000`
2. **Database**: PostgreSQL database with all migrations applied
3. **Dependencies**: `jq` for JSON parsing (optional but recommended)

---

## 🚀 Quick Start Testing

### Option 1: PowerShell Script (Windows)
```powershell
# Quick test
.\quick-scoring-test.ps1

# Full comprehensive test
.\test-scoring-flow.ps1
```

### Option 2: Bash Script (Linux/Mac)
```bash
# Make executable
chmod +x test-scoring-flow.sh

# Run full test
./test-scoring-flow.sh
```

### Option 3: Manual Testing
Follow the step-by-step guide below.

---

## 📋 Step-by-Step Manual Testing

### Step 1: Server Health Check
```http
GET http://localhost:3000/health
```
**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Step 2: User Registration & Authentication

#### 2.1 Register Nodal Officer
```http
POST http://localhost:3000/auth/register
Content-Type: application/json

{
  "email": "nodal.test@maharashtra.gov.in",
  "password": "password123",
  "firstName": "Nodal",
  "lastName": "Test",
  "role": "NODAL_OFFICER",
  "stateUt": "Maharashtra"
}
```

#### 2.2 Register State Approver
```http
POST http://localhost:3000/auth/register
Content-Type: application/json

{
  "email": "state.test@maharashtra.gov.in",
  "password": "password123",
  "firstName": "State",
  "lastName": "Test",
  "role": "STATE_APPROVER",
  "stateUt": "Maharashtra"
}
```

#### 2.3 Register MoSPI Approver
```http
POST http://localhost:3000/auth/register
Content-Type: application/json

{
  "email": "mospi.test@mospi.gov.in",
  "password": "password123",
  "firstName": "MoSPI",
  "lastName": "Test",
  "role": "MOSPI_APPROVER",
  "stateUt": "Central"
}
```

#### 2.4 Login and Get Tokens
```http
POST http://localhost:3000/auth/login
Content-Type: application/json

{
  "email": "nodal.test@maharashtra.gov.in",
  "password": "password123"
}
```

**Save the `accessToken` from each login response.**

---

### Step 3: Form Data Validation

#### 3.1 Test Form Validation
```http
POST http://localhost:3000/scoring/validate-form-data
Authorization: Bearer <nodal_token>
Content-Type: application/json

{
  "infraFinancing": {
    "capexToGSDP": {
      "capitalAllocation": 50000,
      "gsdp": 500000,
      "percentage": 10
    }
  }
}
```

**Expected Response:**
```json
{
  "status": true,
  "data": {
    "isValid": false,
    "errors": ["Missing required category: infraDevelopment"],
    "warnings": [],
    "missingFields": ["infraDevelopment", "pppDevelopment", "infraEnablers"],
    "scoreEstimate": 0
  }
}
```

---

### Step 4: Create Test Submission

#### 4.1 Create Submission with Complete Form Data
```http
POST http://localhost:3000/submission
Authorization: Bearer <nodal_token>
Content-Type: application/json

{
  "submissionId": "TEST-SCORING-001",
  "formData": {
    "infraFinancing": {
      "capexToGSDP": {
        "capitalAllocation": 50000,
        "gsdp": 500000,
        "percentage": 10
      },
      "capexUtilization": {
        "actualCapex": 45000,
        "allocatedCapex": 50000,
        "percentage": 90
      },
      "creditRatedULBs": {
        "ratedULBs": 15,
        "totalULBs": 30,
        "percentage": 50
      },
      "ulbBonds": {
        "approvedULBs": 8,
        "totalULBs": 30,
        "percentage": 26.67
      },
      "financialIntermediary": {
        "hasIntermediary": true,
        "subSectors": ["Transport", "Water", "Energy"],
        "documentUploaded": true
      }
    },
    "infraDevelopment": {
      "infrastructureAct": {
        "selectedSectors": ["Transport", "Water", "Energy", "Urban Development"],
        "hasOverarching": true,
        "documentUploaded": true
      },
      "specializedEntity": {
        "selectedSectors": ["Transport", "Water"],
        "documentUploaded": true
      },
      "sectorPlan": {
        "selectedSectors": ["Transport", "Water", "Energy"],
        "hasOverarching": false,
        "documentUploaded": true
      },
      "projectPipeline": {
        "projects": [
          {
            "projectName": "Highway Project A",
            "documentUploaded": true
          },
          {
            "projectName": "Water Treatment Plant B",
            "documentUploaded": true
          }
        ]
      },
      "assetMonetization": {
        "assets": [
          {
            "assetName": "Toll Road Asset 1",
            "documentUploaded": true
          }
        ]
      }
    },
    "pppDevelopment": {
      "pppAct": {
        "hasAct": "yes",
        "documentUploaded": true
      },
      "pppCell": {
        "hasCell": true,
        "documentUploaded": true
      },
      "vgfIipdfProposals": {
        "proposals": [
          {
            "projectName": "VGF Project 1",
            "documentUploaded": true
          },
          {
            "projectName": "IIPDF Project 2",
            "documentUploaded": true
          }
        ]
      },
      "pppProportion": {
        "pppProjectCost": 20000,
        "totalInfraCost": 50000,
        "percentage": 40
      }
    },
    "infraEnablers": {
      "nipPortal": {
        "allProjectsListed": true,
        "documentUploaded": true
      },
      "statePMG": {
        "hasPMG": true,
        "documentOrUrl": "https://statepmg.example.com"
      },
      "gatiShakti": {
        "projects": [
          {
            "projectName": "GatiShakti Project 1",
            "evidenceUploaded": true
          },
          {
            "projectName": "GatiShakti Project 2",
            "evidenceUploaded": true
          }
        ]
      },
      "adr": {
        "hasADR": true,
        "documentUploaded": true
      },
      "innovativePractices": {
        "practices": [
          {
            "practiceName": "Digital Payment Integration",
            "evidenceUploaded": true
          },
          {
            "practiceName": "AI-based Traffic Management",
            "evidenceUploaded": true
          }
        ]
      },
      "capacityBuilding": {
        "officers": [
          {
            "officerName": "John Doe",
            "designation": "Chief Engineer",
            "trainingCompleted": true
          },
          {
            "officerName": "Jane Smith",
            "designation": "Project Manager",
            "trainingCompleted": true
          }
        ]
      }
    }
  },
  "status": "SUBMITTED_TO_STATE"
}
```

---

### Step 5: Workflow Testing

#### 5.1 Forward to MoSPI (State Approver)
```http
PATCH http://localhost:3000/submission/{submission_id}/forward
Authorization: Bearer <state_token>
Content-Type: application/json

{
  "comment": "Approved by State - Ready for MoSPI review"
}
```

#### 5.2 Final Approval (MoSPI Approver)
```http
PATCH http://localhost:3000/submission/{submission_id}/approve
Authorization: Bearer <mospi_token>
Content-Type: application/json

{
  "comment": "Final approval granted by MoSPI"
}
```

---

### Step 6: Scoring System Testing

#### 6.1 Calculate Score
```http
GET http://localhost:3000/scoring/calculate/{submission_id}
Authorization: Bearer <mospi_token>
```

**Expected Response:**
```json
{
  "status": true,
  "data": {
    "id": "uuid",
    "submissionId": "TEST-SCORING-001",
    "stateUt": "Maharashtra",
    "totalScore": 750.50,
    "scoreBreakdown": {
      "totalScore": 750.50,
      "maxPossibleScore": 1000,
      "percentage": 75.05,
      "categories": [
        {
          "categoryName": "Infra Financing",
          "categoryScore": 200.00,
          "maxCategoryScore": 250,
          "percentage": 80.00,
          "calculations": [...]
        }
      ],
      "methodology": "NIRI Scoring Methodology v2.0",
      "calculationDate": "2024-01-01T00:00:00.000Z"
    },
    "categoryScores": {
      "Infra Financing": 200.00,
      "Infra Development": 180.00,
      "PPP Development": 190.00,
      "Infra Enablers": 180.50
    },
    "scoringVersion": "2.0"
  }
}
```

#### 6.2 Get Detailed Score
```http
GET http://localhost:3000/scoring/detailed/{submission_id}
Authorization: Bearer <mospi_token>
```

#### 6.3 Get Rankings
```http
GET http://localhost:3000/scoring/rankings
Authorization: Bearer <mospi_token>
```

#### 6.4 Get Statistics
```http
GET http://localhost:3000/scoring/statistics
Authorization: Bearer <mospi_token>
```

#### 6.5 Get Category Scores
```http
GET http://localhost:3000/scoring/category/Infra Financing
Authorization: Bearer <mospi_token>
```

#### 6.6 Get Methodology
```http
GET http://localhost:3000/scoring/methodology
Authorization: Bearer <mospi_token>
```

---

## 🧪 Automated Testing

### Run E2E Tests
```bash
# Run all tests
npm run test:e2e

# Run only scoring tests
npm run test:e2e -- --testNamePattern="scoring"
```

### Run Unit Tests
```bash
# Run all unit tests
npm run test

# Run only scoring service tests
npm run test -- --testNamePattern="scoring"
```

---

## 🔍 Test Scenarios

### 1. Happy Path Testing
- ✅ Complete workflow from submission to scoring
- ✅ All scoring endpoints working
- ✅ Correct score calculations
- ✅ Proper error handling

### 2. Error Scenario Testing
- ❌ Invalid submission ID
- ❌ Unauthorized access
- ❌ Non-existent submission
- ❌ Scoring non-approved submission
- ❌ Invalid form data structure

### 3. Edge Case Testing
- 🔄 Multiple submissions
- 🔄 Large form data
- 🔄 Concurrent requests
- 🔄 Database constraints

### 4. Performance Testing
- ⚡ Response times
- ⚡ Memory usage
- ⚡ Database queries
- ⚡ Concurrent users

---

## 📊 Expected Test Results

### Score Calculation
- **Total Score Range**: 0-1000 marks
- **Category Scores**: 0-250 marks each
- **Percentage**: 0-100%
- **Version**: 2.0

### Response Times
- **Calculate Score**: < 2 seconds
- **Get Rankings**: < 1 second
- **Get Statistics**: < 1 second
- **Form Validation**: < 500ms

### Error Handling
- **Invalid Input**: 400 Bad Request
- **Unauthorized**: 403 Forbidden
- **Not Found**: 404 Not Found
- **Server Error**: 500 Internal Server Error

---

## 🐛 Troubleshooting

### Common Issues

#### 1. Server Not Running
```
Error: Server is not running
Solution: Start the server with `npm run start:dev`
```

#### 2. Database Connection Error
```
Error: Database connection failed
Solution: Check database credentials and ensure PostgreSQL is running
```

#### 3. Migration Error
```
Error: Migration failed
Solution: Run `npm run migration:run`
```

#### 4. Authentication Error
```
Error: Invalid token
Solution: Re-register users and get fresh tokens
```

#### 5. Scoring Error
```
Error: Can only calculate score for approved submissions
Solution: Ensure submission is in APPROVED status
```

---

## 📝 Test Checklist

### Pre-Testing
- [ ] Server is running
- [ ] Database is connected
- [ ] Migrations are applied
- [ ] Test users are registered

### Core Functionality
- [ ] Form data validation works
- [ ] Submission creation works
- [ ] Workflow progression works
- [ ] Score calculation works
- [ ] All scoring endpoints work

### Error Handling
- [ ] Invalid inputs handled
- [ ] Unauthorized access blocked
- [ ] Proper error messages
- [ ] Graceful failures

### Performance
- [ ] Response times acceptable
- [ ] No memory leaks
- [ ] Database queries optimized
- [ ] Concurrent requests handled

### Documentation
- [ ] API responses match documentation
- [ ] Error messages are clear
- [ ] Status codes are correct
- [ ] Examples work as expected

---

## 🎯 Success Criteria

### Functional Requirements
- ✅ All 20+ indicators calculated correctly
- ✅ 1000 marks system working
- ✅ 4 categories properly scored
- ✅ Binary logic implemented
- ✅ Array processing working
- ✅ File validation integrated

### Non-Functional Requirements
- ✅ Response times < 2 seconds
- ✅ 99.9% uptime
- ✅ Secure authentication
- ✅ Proper error handling
- ✅ Comprehensive logging

### User Experience
- ✅ Clear error messages
- ✅ Intuitive API responses
- ✅ Consistent response format
- ✅ Helpful validation feedback

---

## 🚀 Production Readiness

### Before Going Live
1. **Load Testing**: Test with 100+ concurrent users
2. **Data Validation**: Test with real-world data
3. **Security Audit**: Review authentication and authorization
4. **Performance Monitoring**: Set up monitoring and alerts
5. **Backup Strategy**: Ensure data backup and recovery
6. **Documentation**: Complete API documentation
7. **Training**: Train users on new scoring system

### Monitoring
- **Response Times**: Monitor API response times
- **Error Rates**: Track error rates and types
- **Database Performance**: Monitor query performance
- **Memory Usage**: Track memory consumption
- **User Activity**: Monitor user interactions

यह comprehensive testing guide आपको NIRI scoring system को thoroughly test करने में मदद करेगी!


