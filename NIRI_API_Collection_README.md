# NIRI Backend - Complete API Collection

## 📋 Overview
यह एक comprehensive Postman collection है जो NIRI (National Infrastructure Readiness Index) Backend System के सभी APIs को cover करता है। इसमें सभी endpoints, headers, payloads, और examples शामिल हैं।

## 🚀 Features
- **Complete API Coverage**: सभी 50+ endpoints को cover करता है
- **Role-based Authentication**: अलग-अलग user roles के लिए separate tokens
- **Realistic Test Data**: Production-ready sample data
- **Automated Token Management**: Login responses से automatically tokens extract करता है
- **Complete Workflow Testing**: End-to-end workflow testing
- **File Upload Support**: Single और multiple file uploads
- **Error Handling**: Proper error responses और status codes

## 📁 Collection Structure

### 1. 🔐 Authentication
- User Registration (सभी roles के लिए)
- Login (सभी roles के लिए)
- Profile Management
- Password Change
- Admin Access Testing

### 2. 👥 User Management
- Get All Users
- Get Users by State/Role
- Create/Update/Delete Users
- Bulk Operations

### 3. 🏛️ States Management
- Get All States
- Get States Only/Union Territories
- State Validation
- Role-based State Access

### 4. 📝 Submission Workflow
- Create/Update Submissions
- Complete Workflow (Draft → State → MoSPI → Approval)
- Comments और Status Updates
- Rejection और Resubmission Flow

### 5. 🎯 Scoring System
- Score Calculation
- Rankings और Statistics
- State-specific Scores

### 6. 📊 Dashboard
- Summary और KPIs
- Recent Activities
- Role-specific Data

### 7. 📈 Reports
- Rankings Export (JSON/CSV)
- Full Reports
- State Reports
- Status Reports

### 8. 📁 File Storage
- Single/Multiple File Upload
- File URL Generation
- File Deletion
- Storage Information

### 9. 🔍 Audit Logs
- Complete Audit Trail
- Entity-specific Logs
- User Activity
- Statistics

### 10. 🚀 Complete Workflow Test
- End-to-end Testing
- All User Roles
- File Uploads
- Score Calculation

## 🛠️ Setup Instructions

### 1. Import Collection
```bash
# Postman में import करें
File → Import → NIRI_Complete_API_Collection.json
```

### 2. Environment Variables
Collection में pre-configured variables हैं:
- `baseUrl`: http://localhost:3000
- `authToken`: Auto-managed
- `submissionId`: Auto-managed
- `userId`: Auto-managed
- `filePath`: Auto-managed

### 3. Authentication Setup
1. पहले सभी users को register करें
2. फिर सभी roles के लिए login करें
3. Tokens automatically set हो जाएंगे

## 📊 API Endpoints Summary

### Authentication (5 endpoints)
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `GET /auth/profile` - Get user profile
- `PUT /auth/change-password` - Change password
- `GET /auth/test-admin` - Test admin access

### User Management (8 endpoints)
- `GET /users` - Get all users
- `GET /users/by-state/:stateUt` - Get users by state
- `GET /users/by-role/:role` - Get users by role
- `GET /users/:id` - Get user by ID
- `POST /users/create` - Create user
- `PATCH /users/:id` - Update user
- `DELETE /users/:id` - Deactivate user
- `DELETE /users/bulk/delete` - Bulk deactivate

### States Management (6 endpoints)
- `GET /states` - Get all states
- `GET /states/states-only` - Get states only
- `GET /states/union-territories` - Get union territories
- `GET /states/validate` - Validate state
- `GET /states/for-user` - Get states for user
- `GET /states/for-creation` - Get states for creation

### Submission Workflow (15 endpoints)
- `POST /submission` - Create submission
- `GET /submission` - Get all submissions
- `GET /submission/:id` - Get submission by ID
- `PATCH /submission/:id` - Update submission
- `POST /submission/:id/comment` - Add comment
- `POST /submission/update-status/:id` - Update status
- `POST /submission/submit-to-state/:id` - Submit to state
- `POST /submission/forward-to-mospi-reviewer/:id` - Forward to MoSPI reviewer
- `POST /submission/forward-to-mospi-approver/:id` - Forward to MoSPI approver
- `POST /submission/send-back-to-state/:id` - Send back to state
- `POST /submission/forward-to-mospi/:id` - Forward to MoSPI
- `POST /submission/state-reject/:id` - State reject
- `POST /submission/final-reject/:id` - Final reject
- `POST /submission/resubmit/:id` - Resubmit
- `POST /submission/approve/:id` - Approve submission

### Scoring System (4 endpoints)
- `GET /scoring/calculate/:submissionId` - Calculate score
- `GET /scoring/rankings` - Get rankings
- `GET /scoring/statistics` - Get statistics
- `GET /scoring/state/:stateUt` - Get state score

### Dashboard (3 endpoints)
- `GET /dashboard/summary` - Get dashboard summary
- `GET /dashboard/kpis` - Get KPIs
- `GET /dashboard/recent-activities` - Get recent activities

### Reports (6 endpoints)
- `GET /report/ranking` - Get rankings
- `GET /report/full-report` - Get full report
- `GET /report/state/:stateUt` - Get state report
- `GET /report/export` - Export rankings
- `GET /report/submission-status` - Get submission status report

### File Storage (5 endpoints)
- `POST /file/upload/:submissionId` - Upload single file
- `POST /file/upload-multiple/:submissionId` - Upload multiple files
- `GET /file/url/:filePath` - Get file URL
- `DELETE /file/:filePath` - Delete file
- `GET /file/storage-info` - Get storage info

### Audit Logs (5 endpoints)
- `GET /audit` - Get all audit logs
- `GET /audit/entity/:entityType/:entityId` - Get entity audit trail
- `GET /audit/user/:userId` - Get user audit logs
- `GET /audit/stats` - Get audit statistics
- `GET /audit/my-activity` - Get my activity

## 🔐 Authentication Flow

### 1. Register Users
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

### 2. Login
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### 3. Response
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
  "message": "Login successful"
}
```

## 📝 Sample Form Data Structure

### Complete Form Data
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

## 🎯 User Roles और Permissions

### NODAL_OFFICER
- Create/Update submissions
- Upload files
- Submit to state
- Resubmit after rejection

### STATE_APPROVER
- View submissions from their state
- Forward to MoSPI
- Reject submissions
- Add comments

### MOSPI_REVIEWER
- View all submissions
- Add review comments
- Forward to MoSPI Approver
- Send back to state

### MOSPI_APPROVER
- Approve/Reject submissions
- Calculate scores
- View reports
- Access audit logs

## 🔧 Testing Workflow

### 1. Setup Phase
1. Register all user types
2. Login with each role
3. Verify token management

### 2. Submission Phase
1. Create submission as Nodal Officer
2. Upload supporting documents
3. Submit to state

### 3. Review Phase
1. State Approver reviews and forwards to MoSPI
2. MoSPI Reviewer adds comments
3. MoSPI Approver approves

### 4. Scoring Phase
1. Calculate score
2. View rankings
3. Generate reports

## 📊 Response Format

### Success Response
```json
{
  "status": true,
  "data": { ... },
  "message": "Operation successful",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Error Response
```json
{
  "statusCode": 400,
  "message": "Bad Request - Invalid data provided",
  "error": "Bad Request"
}
```

## 🚨 Error Handling

### Common Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

### Error Types
- Validation Errors
- Authentication Errors
- Authorization Errors
- Not Found Errors
- Server Errors

## 📈 Performance Considerations

### File Upload Limits
- Single file: 10MB max
- Multiple files: 10 files max
- Supported formats: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG

### Rate Limiting
- 100 requests per minute per user
- 1000 requests per hour per IP

### Caching
- GET requests cached for 5 minutes
- File URLs cached for 1 hour

## 🔒 Security Features

### Authentication
- JWT tokens with 24-hour expiry
- Refresh token mechanism
- Role-based access control

### File Security
- Virus scanning
- File type validation
- Size limits
- Secure file storage

### Data Protection
- Input validation
- SQL injection prevention
- XSS protection
- CSRF protection

## 📞 Support

### Documentation
- API Documentation: `NIRI_SCORING_API_DOCUMENTATION.md`
- Collection: `NIRI_Complete_API_Collection.json`
- README: `NIRI_API_Collection_README.md`

### Testing
- Unit Tests: `test/` directory
- E2E Tests: `test/` directory
- Manual Tests: Postman collection

### Troubleshooting
1. Check server logs
2. Verify authentication
3. Check request format
4. Validate file uploads

## 🎉 Conclusion

यह collection NIRI Backend System के सभी features को comprehensive तरीके से test करने के लिए बनाया गया है। इसमें realistic data, proper error handling, और complete workflow testing शामिल है।

**Happy Testing! 🚀**
