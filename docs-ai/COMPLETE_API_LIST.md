# 🎯 NIRI Backend API - Complete Functional Endpoints List

## ✅ **All Working APIs with Test Data by Role**

### 🔐 **Authentication APIs (No Role Required)**

| Endpoint         | Method | Status     | Description       | Test Data Available             |
| ---------------- | ------ | ---------- | ----------------- | ------------------------------- |
| `/auth/register` | POST   | ✅ Working | User registration | Multiple users across states    |
| `/auth/login`    | POST   | ✅ Working | User login        | Valid credentials for all roles |
| `/health`        | GET    | ✅ Working | Health check      | Database connectivity verified  |

---

### 👤 **NODAL_OFFICER Role APIs**

| Endpoint                          | Method | Status     | Description                  | Test Data Available            |
| --------------------------------- | ------ | ---------- | ---------------------------- | ------------------------------ |
| `/submission`                     | POST   | ✅ Working | Create new submission        | 7+ submissions created         |
| `/submission`                     | GET    | ✅ Working | List submissions             | 7 submissions with pagination  |
| `/submission/:id`                 | GET    | ✅ Working | Get specific submission      | Multiple submissions available |
| `/submission/:id`                 | PATCH  | ✅ Working | Update submission            | Only DRAFT status allowed      |
| `/submission/submit-to-state/:id` | POST   | ✅ Working | Submit draft to state        | Status transition working      |
| `/submission/resubmit/:id`        | POST   | ✅ Working | Resubmit rejected submission | Rejection count increment      |
| `/submission/:id/comment`         | POST   | ✅ Working | Add review comment           | Comments stored in JSONB       |
| `/auth/profile`                   | GET    | ✅ Working | Get user profile             | Profile data available         |
| `/auth/change-password`           | PUT    | ✅ Working | Change password              | Password update working        |
| `/dashboard/summary`              | GET    | ✅ Working | Dashboard summary            | Realistic metrics              |
| `/dashboard/kpis`                 | GET    | ✅ Working | Key Performance Indicators   | KPIs with current data         |

**Test Data Available:**

- **Users**: 4+ Nodal Officers (Maharashtra, Karnataka, Tamil Nadu, Gujarat)
- **Submissions**: 7 submissions with different statuses
- **Statuses**: DRAFT, SUBMITTED_TO_STATE
- **Form Data**: Infrastructure metrics, budget allocation, project details

---

### 🏛️ **STATE_APPROVER Role APIs**

| Endpoint                           | Method | Status     | Description                | Test Data Available                     |
| ---------------------------------- | ------ | ---------- | -------------------------- | --------------------------------------- |
| `/submission`                      | GET    | ✅ Working | List submissions           | All submissions visible                 |
| `/submission/:id`                  | GET    | ✅ Working | Get specific submission    | Full submission details                 |
| `/submission/forward-to-mospi/:id` | POST   | ✅ Working | Forward to MoSPI           | Status transition to SUBMITTED_TO_MOSPI |
| `/submission/state-reject/:id`     | POST   | ✅ Working | Reject submission          | Status to REJECTED_TO_STATE             |
| `/submission/:id/comment`          | POST   | ✅ Working | Add review comment         | State-level comments                    |
| `/users`                           | GET    | ✅ Working | List users                 | All users visible                       |
| `/users/:id`                       | GET    | ✅ Working | Get specific user          | User details available                  |
| `/users/:id`                       | PATCH  | ✅ Working | Update user                | User management                         |
| `/users/:id`                       | DELETE | ✅ Working | Delete user                | User deletion                           |
| `/users/by-state/:stateUt`         | GET    | ✅ Working | Users by state             | State-wise filtering                    |
| `/users/by-role/:role`             | GET    | ✅ Working | Users by role              | Role-wise filtering                     |
| `/auth/profile`                    | GET    | ✅ Working | Get user profile           | Profile data available                  |
| `/auth/change-password`            | PUT    | ✅ Working | Change password            | Password update working                 |
| `/dashboard/summary`               | GET    | ✅ Working | Dashboard summary          | State-level metrics                     |
| `/dashboard/kpis`                  | GET    | ✅ Working | Key Performance Indicators | State KPIs                              |

**Test Data Available:**

- **Users**: 4+ State Approvers (Maharashtra, Karnataka, Tamil Nadu, Gujarat)
- **Submissions**: 7 submissions to review
- **Workflow**: Forward to MoSPI, State rejection working
- **Comments**: Review comments system working

---

### 🔍 **MOSPI_REVIEWER Role APIs**

| Endpoint                              | Method | Status     | Description                | Test Data Available     |
| ------------------------------------- | ------ | ---------- | -------------------------- | ----------------------- |
| `/submission`                         | GET    | ✅ Working | List submissions           | All submissions visible |
| `/submission/:id`                     | GET    | ✅ Working | Get specific submission    | Full submission details |
| `/submission/:id/comment`             | POST   | ✅ Working | Add review comment         | MoSPI-level comments    |
| `/submission/approve/:id`             | POST   | ✅ Working | Approve submission         | Final approval workflow |
| `/submission/final-reject/:id`        | POST   | ✅ Working | Final rejection            | REJECTED_FINAL status   |
| `/users`                              | GET    | ✅ Working | List users                 | All users visible       |
| `/users/:id`                          | GET    | ✅ Working | Get specific user          | User details available  |
| `/users/:id`                          | PATCH  | ✅ Working | Update user                | User management         |
| `/users/:id`                          | DELETE | ✅ Working | Delete user                | User deletion           |
| `/audit`                              | GET    | ✅ Working | Audit logs                 | All audit entries       |
| `/audit/entity/:entityType/:entityId` | GET    | ✅ Working | Entity audit logs          | Entity-specific logs    |
| `/audit/user/:userId`                 | GET    | ✅ Working | User audit logs            | User-specific logs      |
| `/audit/stats`                        | GET    | ✅ Working | Audit statistics           | Audit metrics           |
| `/audit/my-activity`                  | GET    | ✅ Working | My activity logs           | Personal audit trail    |
| `/report/ranking`                     | GET    | ✅ Working | State ranking report       | Ranking data            |
| `/report/full-report`                 | GET    | ✅ Working | Full report                | Comprehensive report    |
| `/report/state/:stateUt`              | GET    | ✅ Working | State-specific report      | State-wise reports      |
| `/report/export`                      | GET    | ✅ Working | Export report              | Report export           |
| `/report/submission-status`           | GET    | ✅ Working | Submission status report   | Status-wise reports     |
| `/file/storage-info`                  | GET    | ✅ Working | File storage info          | Storage configuration   |
| `/auth/profile`                       | GET    | ✅ Working | Get user profile           | Profile data available  |
| `/auth/change-password`               | PUT    | ✅ Working | Change password            | Password update working |
| `/dashboard/summary`                  | GET    | ✅ Working | Dashboard summary          | MoSPI-level metrics     |
| `/dashboard/kpis`                     | GET    | ✅ Working | Key Performance Indicators | MoSPI KPIs              |

**Test Data Available:**

- **Users**: MoSPI Reviewers available
- **Submissions**: Submissions in SUBMITTED_TO_MOSPI status
- **Reports**: Ranking and comprehensive reports
- **Audit Logs**: Complete audit trail
- **File Management**: Storage configuration

---

### ✅ **MOSPI_APPROVER Role APIs**

| Endpoint                              | Method | Status     | Description                | Test Data Available       |
| ------------------------------------- | ------ | ---------- | -------------------------- | ------------------------- |
| `/submission`                         | GET    | ✅ Working | List submissions           | All submissions visible   |
| `/submission/:id`                     | GET    | ✅ Working | Get specific submission    | Full submission details   |
| `/submission/approve/:id`             | POST   | ✅ Working | Final approval             | APPROVED status + scoring |
| `/submission/final-reject/:id`        | POST   | ✅ Working | Final rejection            | REJECTED_FINAL status     |
| `/submission/:id/comment`             | POST   | ✅ Working | Add review comment         | Final-level comments      |
| `/users`                              | GET    | ✅ Working | List users                 | All users visible         |
| `/users/:id`                          | GET    | ✅ Working | Get specific user          | User details available    |
| `/users/:id`                          | PATCH  | ✅ Working | Update user                | User management           |
| `/users/:id`                          | DELETE | ✅ Working | Delete user                | User deletion             |
| `/audit`                              | GET    | ✅ Working | Audit logs                 | All audit entries         |
| `/audit/entity/:entityType/:entityId` | GET    | ✅ Working | Entity audit logs          | Entity-specific logs      |
| `/audit/user/:userId`                 | GET    | ✅ Working | User audit logs            | User-specific logs        |
| `/audit/stats`                        | GET    | ✅ Working | Audit statistics           | Audit metrics             |
| `/audit/my-activity`                  | GET    | ✅ Working | My activity logs           | Personal audit trail      |
| `/report/ranking`                     | GET    | ✅ Working | State ranking report       | Ranking data              |
| `/report/full-report`                 | GET    | ✅ Working | Full report                | Comprehensive report      |
| `/report/state/:stateUt`              | GET    | ✅ Working | State-specific report      | State-wise reports        |
| `/report/export`                      | GET    | ✅ Working | Export report              | Report export             |
| `/report/submission-status`           | GET    | ✅ Working | Submission status report   | Status-wise reports       |
| `/file/storage-info`                  | GET    | ✅ Working | File storage info          | Storage configuration     |
| `/file/upload/:submissionId`          | POST   | ✅ Working | Upload file                | File upload working       |
| `/file/upload-multiple/:submissionId` | POST   | ✅ Working | Upload multiple files      | Multiple file upload      |
| `/file/:filePath`                     | DELETE | ✅ Working | Delete file                | File deletion             |
| `/file/url/:filePath`                 | GET    | ✅ Working | Get file URL               | File URL generation       |
| `/auth/profile`                       | GET    | ✅ Working | Get user profile           | Profile data available    |
| `/auth/change-password`               | PUT    | ✅ Working | Change password            | Password update working   |
| `/dashboard/summary`                  | GET    | ✅ Working | Dashboard summary          | MoSPI-level metrics       |
| `/dashboard/kpis`                     | GET    | ✅ Working | Key Performance Indicators | MoSPI KPIs                |

**Test Data Available:**

- **Users**: MoSPI Approvers available
- **Submissions**: Submissions ready for final approval
- **Scoring**: Automatic scoring on approval
- **Final Scores**: Calculated scores stored
- **Reports**: Complete reporting system
- **File Management**: Full file upload/download system

---

## 📊 **Test Data Summary**

### **Users Created**

- **Nodal Officers**: 4+ (Maharashtra, Karnataka, Tamil Nadu, Gujarat)
- **State Approvers**: 4+ (Maharashtra, Karnataka, Tamil Nadu, Gujarat)
- **MoSPI Reviewers**: Available
- **MoSPI Approvers**: Available

### **Submissions Created**

- **Total**: 7+ submissions
- **Statuses**: DRAFT, SUBMITTED_TO_STATE, SUBMITTED_TO_MOSPI, APPROVED, REJECTED_TO_STATE, REJECTED_FINAL
- **Form Data**: Infrastructure metrics, budget allocation, project details
- **Comments**: Review comments at all levels
- **Files**: File upload/download system

### **Database Tables**

- **users**: 10+ users across all roles and states
- **submissions**: 7+ submissions with realistic data
- **audit_logs**: Complete audit trail
- **final_scores**: Scoring data for approved submissions

---

## 🎯 **API Response Format**

All APIs return consistent format:

```json
{
  "status": true/false,
  "data": { /* actual data */ },
  "message": "Descriptive message",
  "timestamp": "2025-10-10T19:58:32.896Z"
}
```

---

## 🔗 **Test URLs by Role**

### **Nodal Officer**

- `http://localhost:3000/submission?page=1&limit=20`
- `http://localhost:3000/dashboard/summary`
- `http://localhost:3000/dashboard/kpis`

### **State Approver**

- `http://localhost:3000/submission/forward-to-mospi/:id`
- `http://localhost:3000/submission/state-reject/:id`
- `http://localhost:3000/users`

### **MoSPI Reviewer**

- `http://localhost:3000/report/ranking`
- `http://localhost:3000/report/full-report`
- `http://localhost:3000/audit`

### **MoSPI Approver**

- `http://localhost:3000/submission/approve/:id`
- `http://localhost:3000/submission/final-reject/:id`
- `http://localhost:3000/file/storage-info`

---

## ✅ **Status Codes Used**

- **200 OK**: Successful GET, PATCH, PUT requests
- **201 Created**: Successful POST requests
- **400 Bad Request**: Validation errors
- **401 Unauthorized**: Missing/invalid JWT token
- **403 Forbidden**: Role-based access denied
- **404 Not Found**: Resource not found
- **409 Conflict**: Business rule violations
- **422 Unprocessable Entity**: Field validation errors
- **500 Internal Server Error**: Server errors

---

## 🎉 **Summary**

**All APIs are fully functional with comprehensive test data!**

- ✅ **Authentication**: Working with JWT tokens
- ✅ **Role-Based Access**: Proper permissions enforced
- ✅ **Workflow Management**: Complete 5-tier approval process
- ✅ **File Management**: Upload/download system
- ✅ **Audit Logging**: Complete audit trail
- ✅ **Reporting**: Comprehensive reports and rankings
- ✅ **Dashboard**: Realistic metrics and KPIs
- ✅ **Database**: PostgreSQL with proper relationships
- ✅ **Response Format**: Consistent across all endpoints

**Ready for frontend integration with all roles and functionalities!** 🚀
