# NIRI API Quick Reference Guide

## 🚀 Quick Start

### 1. Import Collection
```
File → Import → NIRI_Complete_API_Collection.json
```

### 2. Set Base URL
```
Variables → baseUrl → http://localhost:3000
```

### 3. Run Authentication
```
1. Register All Users (4 users)
2. Login All Users (4 logins)
3. Tokens auto-set
```

## 📋 Essential Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register user |
| POST | `/auth/login` | Login user |
| GET | `/auth/profile` | Get profile |

### Submissions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/submission` | Create submission |
| GET | `/submission` | Get all submissions |
| GET | `/submission/:id` | Get submission by ID |
| POST | `/submission/submit-to-state/:id` | Submit to state |
| POST | `/submission/approve/:id` | Approve submission |

### Scoring
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/scoring/calculate/:id` | Calculate score |
| GET | `/scoring/rankings` | Get rankings |
| GET | `/scoring/statistics` | Get statistics |

### Files
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/file/upload/:id` | Upload single file |
| POST | `/file/upload-multiple/:id` | Upload multiple files |
| GET | `/file/url/:path` | Get file URL |

## 🔐 User Roles

| Role | Permissions |
|------|-------------|
| `NODAL_OFFICER` | Create, Update, Submit submissions |
| `STATE_APPROVER` | Review, Forward, Reject submissions |
| `MOSPI_REVIEWER` | Review, Comment, Forward submissions |
| `MOSPI_APPROVER` | Approve, Reject, Calculate scores |

## 📊 Sample Data

### Login Request
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Create Submission
```json
{
  "submissionId": "SUB-MH-2024-001",
  "formData": {
    "capexAllocation": 50000000000,
    "gsdp": 2000000000000,
    "actualCapex": 45000000000,
    "stateCapexUtilisation": 50000000000,
    "creditRatedULBs": 45,
    "totalULBs": 100,
    "ulbsApprovedByMoSPI": 30,
    "totalULBsEntered": 100,
    "hasFinancialIntermediary": "Yes",
    "financialIntermediaryDocUploaded": true
  },
  "status": "DRAFT"
}
```

### Add Comment
```json
{
  "text": "This submission looks good and meets all requirements.",
  "type": "comment"
}
```

## 🎯 Workflow Steps

### 1. Create Submission
```
POST /submission
→ NODAL_OFFICER role required
→ Returns submission ID
```

### 2. Upload Files
```
POST /file/upload-multiple/:submissionId
→ NODAL_OFFICER role required
→ Upload supporting documents
```

### 3. Submit to State
```
POST /submission/submit-to-state/:id
→ NODAL_OFFICER role required
→ Changes status to SUBMITTED_TO_STATE
```

### 4. State Review
```
POST /submission/forward-to-mospi/:id
→ STATE_APPROVER role required
→ Changes status to SUBMITTED_TO_MOSPI
```

### 5. MoSPI Review
```
POST /submission/:id/comment
→ MOSPI_REVIEWER role required
→ Add review comments
```

### 6. MoSPI Approval
```
POST /submission/approve/:id
→ MOSPI_APPROVER role required
→ Changes status to APPROVED
```

### 7. Calculate Score
```
GET /scoring/calculate/:id
→ MOSPI_APPROVER role required
→ Calculates final score
```

## 🔧 Common Headers

### Authentication
```
Authorization: Bearer {{authToken}}
```

### Content Type
```
Content-Type: application/json
```

### File Upload
```
Content-Type: multipart/form-data
```

## 📈 Response Format

### Success
```json
{
  "status": true,
  "data": { ... },
  "message": "Operation successful",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Error
```json
{
  "statusCode": 400,
  "message": "Bad Request",
  "error": "Bad Request"
}
```

## 🚨 Common Errors

| Status | Error | Solution |
|--------|-------|----------|
| 401 | Unauthorized | Check token |
| 403 | Forbidden | Check role permissions |
| 404 | Not Found | Check endpoint/ID |
| 400 | Bad Request | Check request body |

## 📁 File Upload

### Single File
```
POST /file/upload/:submissionId
Body: form-data
Key: file
Value: [Select File]
```

### Multiple Files
```
POST /file/upload-multiple/:submissionId
Body: form-data
Key: files
Value: [Select Files] (up to 10)
```

## 🔍 Testing Tips

### 1. Use Variables
- `{{baseUrl}}` for base URL
- `{{authToken}}` for authentication
- `{{submissionId}}` for submission ID

### 2. Check Responses
- Look for `status: true` in success responses
- Check error messages for failures

### 3. Follow Workflow
- Create → Upload → Submit → Review → Approve → Score

### 4. Test Different Roles
- Each role has different permissions
- Test with appropriate tokens

## 📊 Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 500 | Internal Server Error |

## 🎉 Quick Test Sequence

1. **Register Users** (4 requests)
2. **Login Users** (4 requests)
3. **Create Submission** (1 request)
4. **Upload Files** (1 request)
5. **Submit to State** (1 request)
6. **Forward to MoSPI** (1 request)
7. **Add Review Comment** (1 request)
8. **Approve Submission** (1 request)
9. **Calculate Score** (1 request)
10. **View Rankings** (1 request)

**Total: 16 requests for complete workflow test**

## 📞 Support

- **Documentation**: `NIRI_SCORING_API_DOCUMENTATION.md`
- **Collection**: `NIRI_Complete_API_Collection.json`
- **README**: `NIRI_API_Collection_README.md`
- **Quick Reference**: `NIRI_API_Quick_Reference.md`

**Happy Testing! 🚀**
