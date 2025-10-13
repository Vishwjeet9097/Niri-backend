# NIRI Scoring System - Frontend API Documentation

## 🚀 Overview
This document provides complete API documentation for the NIRI Scoring System that frontend developers can use to integrate with the backend.

## 📋 Table of Contents
1. [Authentication](#authentication)
2. [User Management](#user-management)
3. [Submission Workflow](#submission-workflow)
4. [Scoring System](#scoring-system)
5. [Data Structures](#data-structures)
6. [Error Handling](#error-handling)
7. [Complete Implementation Example](#complete-implementation-example)

---

## 🔐 Authentication

### Base URL
```
http://localhost:3000
```

### Login
**Endpoint:** `POST /auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "status": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "NODAL_OFFICER",
      "stateUt": "Maharashtra"
    },
    "accessToken": "jwt_token_here"
  },
  "message": "Login successful",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Register
**Endpoint:** `POST /auth/register`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "role": "NODAL_OFFICER",
  "stateUt": "Maharashtra"
}
```

**Available Roles:**
- `NODAL_OFFICER`
- `STATE_APPROVER`
- `MOSPI_REVIEWER`
- `MOSPI_APPROVER`

---

## 👥 User Management

### Get Users by Role
**Endpoint:** `GET /users/by-role?role=NODAL_OFFICER&stateUt=Maharashtra`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "status": true,
  "data": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "NODAL_OFFICER",
      "stateUt": "Maharashtra"
    }
  ],
  "message": "Users retrieved successfully"
}
```

---

## 📝 Submission Workflow

### 1. Create Submission (NODAL_OFFICER)
**Endpoint:** `POST /submission`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "submissionId": "UNIQUE-SUBMISSION-ID",
  "formData": {
    // Complete form data structure (see Data Structures section)
  },
  "status": "DRAFT"
}
```

**Response:**
```json
{
  "status": true,
  "data": {
    "id": "uuid",
    "submissionId": "UNIQUE-SUBMISSION-ID",
    "stateUt": "Maharashtra",
    "status": "DRAFT",
    "currentOwnerRole": "NODAL_OFFICER",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Submission created successfully"
}
```

### 2. Submit to State (NODAL_OFFICER)
**Endpoint:** `POST /submission/submit-to-state/{submissionId}`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "status": true,
  "data": {
    "id": "uuid",
    "status": "SUBMITTED_TO_STATE",
    "currentOwnerRole": "STATE_APPROVER"
  },
  "message": "Submission submitted to state successfully"
}
```

### 3. Forward to MoSPI (STATE_APPROVER)
**Endpoint:** `POST /submission/forward-to-mospi/{submissionId}`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "comment": "Forwarded to MoSPI for review"
}
```

**Response:**
```json
{
  "status": true,
  "data": {
    "id": "uuid",
    "status": "SUBMITTED_TO_MOSPI",
    "currentOwnerRole": "MOSPI_REVIEWER"
  },
  "message": "Submission forwarded to MoSPI successfully"
}
```

### 4. Forward to MoSPI Approver (MOSPI_REVIEWER)
**Endpoint:** `POST /submission/forward-to-mospi-approver/{submissionId}`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "status": "SUBMITTED_TO_MOSPI_APPROVER",
  "comment": "Reviewed and approved, forwarding to MoSPI Approver"
}
```

**Response:**
```json
{
  "status": true,
  "data": {
    "id": "uuid",
    "status": "SUBMITTED_TO_MOSPI_APPROVER",
    "currentOwnerRole": "MOSPI_APPROVER"
  },
  "message": "Submission forwarded to MoSPI Approver successfully"
}
```

### 5. Approve Submission (MOSPI_APPROVER)
**Endpoint:** `POST /submission/approve/{submissionId}`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "status": "APPROVED",
  "comment": "Approved by MoSPI Approver"
}
```

**Response:**
```json
{
  "status": true,
  "data": {
    "id": "uuid",
    "status": "APPROVED",
    "currentOwnerRole": "MOSPI_APPROVER"
  },
  "message": "Submission approved successfully"
}
```

### 6. Get Submission Details
**Endpoint:** `GET /submission/{submissionId}`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "status": true,
  "data": {
    "id": "uuid",
    "submissionId": "UNIQUE-SUBMISSION-ID",
    "stateUt": "Maharashtra",
    "status": "APPROVED",
    "formData": {
      // Complete form data
    },
    "reviewComments": [
      {
        "timestamp": "2024-01-01T00:00:00.000Z",
        "role": "MOSPI_APPROVER",
        "userId": "uuid",
        "text": "Approved by MoSPI Approver",
        "type": "approval"
      }
    ],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Submission retrieved successfully"
}
```

---

## 🎯 Scoring System

### Calculate Score (MOSPI_APPROVER)
**Endpoint:** `GET /scoring/calculate/{submissionId}`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "status": true,
  "data": {
    "id": "uuid",
    "submissionId": "uuid",
    "stateUt": "Maharashtra",
    "totalScore": 942.00,
    "maxPossibleScore": 1000,
    "percentage": 94.2,
    "scoreBreakdown": {
      "totalScore": 942.00,
      "maxPossibleScore": 1000,
      "percentage": 94.2,
      "calculations": [
        {
          "indicator": "1.1 % of Capex to GSDP",
          "value": 2.5,
          "weight": 0.05,
          "score": 25,
          "maxScore": 50
        },
        {
          "indicator": "1.2 % Capex Utilization",
          "value": 90,
          "weight": 0.05,
          "score": 50,
          "maxScore": 50
        }
        // ... more indicators
      ],
      "methodology": "NIRI Scoring Methodology v2.0 - Based on detailed infrastructure readiness assessment rubric (1000 marks total)"
    },
    "calculationMethodology": "NIRI Scoring Methodology v2.0 - Based on detailed infrastructure readiness assessment rubric (1000 marks total)",
    "approvedBy": "uuid",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "Score calculated successfully"
}
```

### Get Score Rankings
**Endpoint:** `GET /scoring/rankings`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "status": true,
  "data": [
    {
      "rank": 1,
      "stateUt": "Maharashtra",
      "totalScore": 942,
      "percentage": 94.2,
      "approvedAt": "2024-01-01T00:00:00.000Z",
      "submissionId": "uuid"
    }
  ],
  "message": "Score rankings retrieved successfully"
}
```

### Get Score Statistics
**Endpoint:** `GET /scoring/statistics`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "status": true,
  "data": {
    "totalStates": 1,
    "averageScore": 942,
    "highestScore": 942,
    "lowestScore": 942,
    "scoreDistribution": {
      "90-100": 1,
      "80-89": 0,
      "70-79": 0,
      "60-69": 0,
      "50-59": 0,
      "Below 50": 0
    }
  },
  "message": "Score statistics retrieved successfully"
}
```

---

## 📊 Data Structures

### Complete Form Data Structure
```typescript
interface FormData {
  // Infra Financing (250 marks)
  capexAllocation: number;                    // Capital Allocation for FY (INR)
  gsdp: number;                              // GSDP for FY (INR)
  actualCapex: number;                       // Actual Capex (INR)
  stateCapexUtilisation: number;             // State Capex Utilisation (INR)
  creditRatedULBs: number;                   // No. of ULBs with Rating Date filled
  totalULBs: number;                         // Total Number of ULBs
  ulbsApprovedByMoSPI: number;               // No. of ULBs approved by MoSPI
  totalULBsEntered: number;                  // Total Number of ULBs entered
  hasFinancialIntermediary: "Yes" | "No";    // Yes/No selection
  financialIntermediaryDocUploaded: boolean; // Document upload status

  // Infra Development (250 marks)
  infraActSectors: Array<{
    sector: string;
    docUploaded: boolean;
  }>;
  hasOverarchingAct: "Overarching" | string;
  infraActDocUploaded: boolean;
  specializedEntitySectors: Array<{
    sector: string;
    docUploaded: boolean;
  }>;
  sectorPlanSectors: Array<{
    sector: string;
    docUploaded: boolean;
  }>;
  hasOverarchingPlan: "Overarching" | string;
  sectorPlanDocUploaded: boolean;
  investmentProjects: Array<{
    name: string;
    docUploaded: boolean;
  }>;
  assetMonetizationProjects: Array<{
    name: string;
    docUploaded: boolean;
  }>;

  // PPP Development (250 marks)
  hasPPPAct: "Yes" | "No";
  pppActDocUploaded: boolean;
  hasPPPCell: "Yes" | "No";
  pppCellDocUploaded: boolean;
  vgfProjects: Array<{
    name: string;
    docUploaded: boolean;
  }>;
  totalCostBankablePPP: number;              // Total Cost of Bankable/PPP Projects (INR Cr)
  totalCostAllInfraProjects: number;         // Total Cost of All Infra Projects Awarded (INR Cr)

  // Infra Enablers (250 marks)
  allProjectsOnNIP: "Yes" | "No";
  nipDocUploaded: boolean;
  hasStatePMG: "Yes" | "No";
  pmgDocOrURLUploaded: boolean;
  gatiShaktiProjects: Array<{
    name: string;
    evidenceUploaded: boolean;
  }>;
  hasADR: "Yes" | "No";
  adrDocUploaded: boolean;
  innovativePractices: Array<{
    name: string;
    evidenceUploaded: boolean;
  }>;
  capacityBuildingOfficers: Array<{
    name: string;
    designation: string;
    participationDate: string; // YYYY-MM-DD format
  }>;
}
```

### Sample Form Data
```json
{
  "capexAllocation": 50000000000,
  "gsdp": 2000000000000,
  "actualCapex": 45000000000,
  "stateCapexUtilisation": 50000000000,
  "creditRatedULBs": 45,
  "totalULBs": 100,
  "ulbsApprovedByMoSPI": 30,
  "totalULBsEntered": 100,
  "hasFinancialIntermediary": "Yes",
  "financialIntermediaryDocUploaded": true,
  "infraActSectors": [
    { "sector": "Transport", "docUploaded": true },
    { "sector": "Water", "docUploaded": true },
    { "sector": "Energy", "docUploaded": true }
  ],
  "hasOverarchingAct": "Overarching",
  "infraActDocUploaded": true,
  "specializedEntitySectors": [
    { "sector": "Transport", "docUploaded": true },
    { "sector": "Water", "docUploaded": true }
  ],
  "sectorPlanSectors": [
    { "sector": "Transport", "docUploaded": true },
    { "sector": "Water", "docUploaded": true },
    { "sector": "Energy", "docUploaded": true }
  ],
  "hasOverarchingPlan": "Overarching",
  "sectorPlanDocUploaded": true,
  "investmentProjects": [
    { "name": "Highway Project 1", "docUploaded": true },
    { "name": "Water Treatment Plant", "docUploaded": true },
    { "name": "Solar Power Plant", "docUploaded": true },
    { "name": "Metro Rail Project", "docUploaded": true },
    { "name": "Airport Expansion", "docUploaded": true }
  ],
  "assetMonetizationProjects": [
    { "name": "Toll Road Asset", "docUploaded": true },
    { "name": "Port Terminal", "docUploaded": true },
    { "name": "Power Transmission Line", "docUploaded": true },
    { "name": "Water Treatment Facility", "docUploaded": true },
    { "name": "Railway Station", "docUploaded": true }
  ],
  "hasPPPAct": "Yes",
  "pppActDocUploaded": true,
  "hasPPPCell": "Yes",
  "pppCellDocUploaded": true,
  "vgfProjects": [
    { "name": "VGF Project 1", "docUploaded": true },
    { "name": "VGF Project 2", "docUploaded": true },
    { "name": "VGF Project 3", "docUploaded": true },
    { "name": "VGF Project 4", "docUploaded": true },
    { "name": "VGF Project 5", "docUploaded": true },
    { "name": "VGF Project 6", "docUploaded": true },
    { "name": "VGF Project 7", "docUploaded": true },
    { "name": "VGF Project 8", "docUploaded": true },
    { "name": "VGF Project 9", "docUploaded": true },
    { "name": "VGF Project 10", "docUploaded": true }
  ],
  "totalCostBankablePPP": 150000000000,
  "totalCostAllInfraProjects": 200000000000,
  "allProjectsOnNIP": "Yes",
  "nipDocUploaded": true,
  "hasStatePMG": "Yes",
  "pmgDocOrURLUploaded": true,
  "gatiShaktiProjects": [
    { "name": "GatiShakti Project 1", "evidenceUploaded": true },
    { "name": "GatiShakti Project 2", "evidenceUploaded": true },
    { "name": "GatiShakti Project 3", "evidenceUploaded": true },
    { "name": "GatiShakti Project 4", "evidenceUploaded": true }
  ],
  "hasADR": "Yes",
  "adrDocUploaded": true,
  "innovativePractices": [
    { "name": "Digital Payment System", "evidenceUploaded": true },
    { "name": "Smart City Integration", "evidenceUploaded": true },
    { "name": "Green Infrastructure", "evidenceUploaded": true },
    { "name": "AI-based Monitoring", "evidenceUploaded": true },
    { "name": "Blockchain for Transparency", "evidenceUploaded": true }
  ],
  "capacityBuildingOfficers": [
    { "name": "John Doe", "designation": "Chief Engineer", "participationDate": "2024-01-15" },
    { "name": "Jane Smith", "designation": "Project Manager", "participationDate": "2024-01-20" },
    { "name": "Mike Johnson", "designation": "Technical Director", "participationDate": "2024-02-01" }
  ]
}
```

---

## ⚠️ Error Handling

### Common Error Responses
```json
{
  "statusCode": 400,
  "message": "Bad Request - Invalid data provided",
  "error": "Bad Request"
}
```

```json
{
  "statusCode": 401,
  "message": "Unauthorized - Invalid or expired token",
  "error": "Unauthorized"
}
```

```json
{
  "statusCode": 403,
  "message": "Forbidden - Insufficient permissions",
  "error": "Forbidden"
}
```

```json
{
  "statusCode": 404,
  "message": "Not Found - Resource not found",
  "error": "Not Found"
}
```

```json
{
  "statusCode": 500,
  "message": "Internal Server Error",
  "error": "Internal Server Error"
}
```

---

## 🚀 Complete Implementation Example

### JavaScript/TypeScript Example
```typescript
class NIRIScoringAPI {
  private baseURL = 'http://localhost:3000';
  private token: string | null = null;

  // Authentication
  async login(email: string, password: string) {
    const response = await fetch(`${this.baseURL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    
    const data = await response.json();
    if (data.status) {
      this.token = data.data.accessToken;
      return data.data.user;
    }
    throw new Error(data.message);
  }

  // Create Submission
  async createSubmission(submissionData: any) {
    const response = await fetch(`${this.baseURL}/submission`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: JSON.stringify(submissionData),
    });
    
    return await response.json();
  }

  // Submit to State
  async submitToState(submissionId: string) {
    const response = await fetch(`${this.baseURL}/submission/submit-to-state/${submissionId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
    });
    
    return await response.json();
  }

  // Forward to MoSPI
  async forwardToMoSPI(submissionId: string, comment: string) {
    const response = await fetch(`${this.baseURL}/submission/forward-to-mospi/${submissionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: JSON.stringify({ comment }),
    });
    
    return await response.json();
  }

  // Forward to MoSPI Approver
  async forwardToMoSPIApprover(submissionId: string, comment: string) {
    const response = await fetch(`${this.baseURL}/submission/forward-to-mospi-approver/${submissionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: JSON.stringify({
        status: 'SUBMITTED_TO_MOSPI_APPROVER',
        comment,
      }),
    });
    
    return await response.json();
  }

  // Approve Submission
  async approveSubmission(submissionId: string, comment: string) {
    const response = await fetch(`${this.baseURL}/submission/approve/${submissionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: JSON.stringify({
        status: 'APPROVED',
        comment,
      }),
    });
    
    return await response.json();
  }

  // Calculate Score
  async calculateScore(submissionId: string) {
    const response = await fetch(`${this.baseURL}/scoring/calculate/${submissionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
    });
    
    return await response.json();
  }

  // Get Score Rankings
  async getScoreRankings() {
    const response = await fetch(`${this.baseURL}/scoring/rankings`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
    });
    
    return await response.json();
  }

  // Get Score Statistics
  async getScoreStatistics() {
    const response = await fetch(`${this.baseURL}/scoring/statistics`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
    });
    
    return await response.json();
  }
}

// Usage Example
const api = new NIRIScoringAPI();

// Complete workflow example
async function completeWorkflow() {
  try {
    // 1. Login
    const user = await api.login('nodal@example.com', 'nodal123');
    console.log('Logged in as:', user.role);

    // 2. Create submission
    const submission = await api.createSubmission({
      submissionId: 'TEST-SUB-' + Date.now(),
      formData: {
        // Complete form data here
        capexAllocation: 50000000000,
        gsdp: 2000000000000,
        // ... rest of the form data
      },
      status: 'DRAFT'
    });
    console.log('Submission created:', submission.data.id);

    // 3. Submit to state
    await api.submitToState(submission.data.id);
    console.log('Submitted to state');

    // 4. Login as state approver and forward to MoSPI
    await api.login('state@example.com', 'state123');
    await api.forwardToMoSPI(submission.data.id, 'Forwarded to MoSPI for review');
    console.log('Forwarded to MoSPI');

    // 5. Login as MoSPI reviewer and forward to approver
    await api.login('reviewer@example.com', 'reviewer123');
    await api.forwardToMoSPIApprover(submission.data.id, 'Reviewed and approved');
    console.log('Forwarded to MoSPI Approver');

    // 6. Login as MoSPI approver and approve
    await api.login('admin@example.com', 'admin123');
    await api.approveSubmission(submission.data.id, 'Approved by MoSPI Approver');
    console.log('Submission approved');

    // 7. Calculate score
    const score = await api.calculateScore(submission.data.id);
    console.log('Score calculated:', score.data.totalScore);

    // 8. Get rankings
    const rankings = await api.getScoreRankings();
    console.log('Rankings:', rankings.data);

  } catch (error) {
    console.error('Error:', error.message);
  }
}
```

### React Hook Example
```typescript
import { useState, useEffect } from 'react';

export const useNIRIScoring = () => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const api = new NIRIScoringAPI();

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const userData = await api.login(email, password);
      setUser(userData);
      setToken(api.token);
      return userData;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const createSubmission = async (submissionData: any) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.createSubmission(submissionData);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const calculateScore = async (submissionId: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.calculateScore(submissionId);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    token,
    loading,
    error,
    login,
    createSubmission,
    calculateScore,
    // ... other methods
  };
};
```

---

## 📝 Notes for Frontend Developers

### 1. **Authentication Flow**
- Always store JWT token securely (localStorage/sessionStorage)
- Include token in Authorization header for all protected endpoints
- Handle token expiration gracefully

### 2. **Form Data Validation**
- Ensure all required fields are present before submission
- Validate data types and formats
- Handle file uploads for document fields

### 3. **Error Handling**
- Implement proper error handling for all API calls
- Show user-friendly error messages
- Handle network errors and timeouts

### 4. **State Management**
- Track submission status throughout the workflow
- Update UI based on current user role and submission status
- Implement proper loading states

### 5. **Scoring Display**
- Show detailed breakdown of scores
- Display category-wise performance
- Implement visual indicators for score ranges

### 6. **Role-Based UI**
- Show/hide features based on user role
- Implement proper navigation based on permissions
- Handle workflow transitions appropriately

---

## 🎯 Quick Start Checklist

- [ ] Set up authentication system
- [ ] Implement form data collection
- [ ] Create submission workflow UI
- [ ] Implement role-based access control
- [ ] Add scoring display components
- [ ] Handle error states
- [ ] Test complete workflow
- [ ] Implement data persistence
- [ ] Add loading states
- [ ] Test with different user roles

---

## 📞 Support

For any questions or issues with the API integration, please refer to:
- API Documentation: This document
- Backend Repository: NIRI Backend
- Test Data: Use the provided sample data structures
- Error Logs: Check browser console and network tab

**Happy Coding! 🚀**
