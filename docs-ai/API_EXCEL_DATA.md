# NIRI Backend API - Complete Working APIs Excel Data

## 📊 **API Endpoints by Role - Detailed Information**

### 🔐 **Authentication APIs (No Role Required)**

| Endpoint         | Method | Status Code | Description       | Request Body                                            | Response Format                                                                 | Test Data Available             | Notes                                 |
| ---------------- | ------ | ----------- | ----------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------- |
| `/auth/register` | POST   | 201         | User registration | `{email, password, firstName, lastName, role, stateUt}` | `{status: true, data: {user, accessToken}, message, timestamp}`                 | Multiple users across states    | Creates new user with JWT token       |
| `/auth/login`    | POST   | 200         | User login        | `{email, password}`                                     | `{status: true, data: {user, accessToken}, message, timestamp}`                 | Valid credentials for all roles | Returns JWT token for authentication  |
| `/health`        | GET    | 200         | Health check      | None                                                    | `{status: true, data: {service, database, uptime, memory}, message, timestamp}` | Database connectivity verified  | Checks database connection and tables |

---

### 👤 **NODAL_OFFICER Role APIs**

| Endpoint                          | Method | Status Code | Description                  | Request Body                              | Response Format                                                                            | Test Data Available            | Notes                                |
| --------------------------------- | ------ | ----------- | ---------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------ | ------------------------------------ |
| `/submission`                     | POST   | 201         | Create new submission        | `{submissionId, formData, attachedFiles}` | `{status: true, data: submission, message, timestamp}`                                     | 7+ submissions created         | Creates submission in DRAFT status   |
| `/submission`                     | GET    | 200         | List submissions             | Query: `?page=1&limit=20`                 | `{status: true, data: {submissions, total}, message, timestamp}`                           | 7 submissions with pagination  | Returns user's submissions only      |
| `/submission/:id`                 | GET    | 200         | Get specific submission      | None                                      | `{status: true, data: submission, message, timestamp}`                                     | Multiple submissions available | Returns submission with user details |
| `/submission/:id`                 | PATCH  | 200         | Update submission            | `{formData, attachedFiles}`               | `{status: true, data: submission, message, timestamp}`                                     | Only DRAFT status allowed      | Updates only if status is DRAFT      |
| `/submission/submit-to-state/:id` | POST   | 200         | Submit draft to state        | `{comment?}`                              | `{status: true, data: submission, message, timestamp}`                                     | Status transition working      | Changes status to SUBMITTED_TO_STATE |
| `/submission/resubmit/:id`        | POST   | 200         | Resubmit rejected submission | `{formData, comment?}`                    | `{status: true, data: submission, message, timestamp}`                                     | Rejection count increment      | Increments rejection_count           |
| `/submission/:id/comment`         | POST   | 201         | Add review comment           | `{comment, role}`                         | `{status: true, data: submission, message, timestamp}`                                     | Comments stored in JSONB       | Adds comment to reviewComments array |
| `/auth/profile`                   | GET    | 200         | Get user profile             | None                                      | `{status: true, data: user, message, timestamp}`                                           | Profile data available         | Returns current user's profile       |
| `/auth/change-password`           | PUT    | 200         | Change password              | `{currentPassword, newPassword}`          | `{status: true, data: null, message, timestamp}`                                           | Password update working        | Updates user password                |
| `/dashboard/summary`              | GET    | 200         | Dashboard summary            | None                                      | `{status: true, data: {pendingSubmissions, approvedSubmissions, etc}, message, timestamp}` | Realistic metrics              | Returns dashboard metrics            |
| `/dashboard/kpis`                 | GET    | 200         | Key Performance Indicators   | None                                      | `{status: true, data: {mySubmissions, pendingReview, etc}, message, timestamp}`            | KPIs with current data         | Returns user-specific KPIs           |

**Test Data Available:**

- **Users**: 4+ Nodal Officers (Maharashtra, Karnataka, Tamil Nadu, Gujarat)
- **Submissions**: 7 submissions with different statuses
- **Statuses**: DRAFT, SUBMITTED_TO_STATE
- **Form Data**: Infrastructure metrics, budget allocation, project details

---

### 🏛️ **STATE_APPROVER Role APIs**

| Endpoint                           | Method | Status Code | Description                | Request Body                         | Response Format                                                                            | Test Data Available                     | Notes                                |
| ---------------------------------- | ------ | ----------- | -------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------ | --------------------------------------- | ------------------------------------ |
| `/submission`                      | GET    | 200         | List submissions           | Query: `?page=1&limit=20&status?`    | `{status: true, data: {submissions, total}, message, timestamp}`                           | All submissions visible                 | Returns all submissions for review   |
| `/submission/:id`                  | GET    | 200         | Get specific submission    | None                                 | `{status: true, data: submission, message, timestamp}`                                     | Full submission details                 | Returns submission with user details |
| `/submission/forward-to-mospi/:id` | POST   | 200         | Forward to MoSPI           | `{comment?}`                         | `{status: true, data: submission, message, timestamp}`                                     | Status transition to SUBMITTED_TO_MOSPI | Changes status and owner role        |
| `/submission/state-reject/:id`     | POST   | 200         | Reject submission          | `{comment, reason}`                  | `{status: true, data: submission, message, timestamp}`                                     | Status to REJECTED_TO_STATE             | Rejects submission back to nodal     |
| `/submission/:id/comment`          | POST   | 201         | Add review comment         | `{comment, role}`                    | `{status: true, data: submission, message, timestamp}`                                     | State-level comments                    | Adds state approver comment          |
| `/users`                           | GET    | 200         | List users                 | Query: `?page=1&limit=20`            | `{status: true, data: users, message, timestamp}`                                          | All users visible                       | Returns all users in system          |
| `/users/:id`                       | GET    | 200         | Get specific user          | None                                 | `{status: true, data: user, message, timestamp}`                                           | User details available                  | Returns user details                 |
| `/users/:id`                       | PATCH  | 200         | Update user                | `{firstName?, lastName?, isActive?}` | `{status: true, data: user, message, timestamp}`                                           | User management                         | Updates user information             |
| `/users/:id`                       | DELETE | 200         | Delete user                | None                                 | `{status: true, data: null, message, timestamp}`                                           | User deletion                           | Soft deletes user                    |
| `/users/by-state/:stateUt`         | GET    | 200         | Users by state             | None                                 | `{status: true, data: users, message, timestamp}`                                          | State-wise filtering                    | Returns users by state               |
| `/users/by-role/:role`             | GET    | 200         | Users by role              | None                                 | `{status: true, data: users, message, timestamp}`                                          | Role-wise filtering                     | Returns users by role                |
| `/auth/profile`                    | GET    | 200         | Get user profile           | None                                 | `{status: true, data: user, message, timestamp}`                                           | Profile data available                  | Returns current user's profile       |
| `/auth/change-password`            | PUT    | 200         | Change password            | `{currentPassword, newPassword}`     | `{status: true, data: null, message, timestamp}`                                           | Password update working                 | Updates user password                |
| `/dashboard/summary`               | GET    | 200         | Dashboard summary          | None                                 | `{status: true, data: {pendingSubmissions, approvedSubmissions, etc}, message, timestamp}` | State-level metrics                     | Returns state-level dashboard        |
| `/dashboard/kpis`                  | GET    | 200         | Key Performance Indicators | None                                 | `{status: true, data: {mySubmissions, pendingReview, etc}, message, timestamp}`            | State KPIs                              | Returns state-level KPIs             |

**Test Data Available:**

- **Users**: 4+ State Approvers (Maharashtra, Karnataka, Tamil Nadu, Gujarat)
- **Submissions**: 7 submissions to review
- **Workflow**: Forward to MoSPI, State rejection working
- **Comments**: Review comments system working

---

### 🔍 **MOSPI_REVIEWER Role APIs**

| Endpoint                              | Method | Status Code | Description                | Request Body                         | Response Format                                                                            | Test Data Available     | Notes                              |
| ------------------------------------- | ------ | ----------- | -------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------ | ----------------------- | ---------------------------------- |
| `/submission`                         | GET    | 200         | List submissions           | Query: `?page=1&limit=20&status?`    | `{status: true, data: {submissions, total}, message, timestamp}`                           | All submissions visible | Returns all submissions            |
| `/submission/:id`                     | GET    | 200         | Get specific submission    | None                                 | `{status: true, data: submission, message, timestamp}`                                     | Full submission details | Returns submission with details    |
| `/submission/:id/comment`             | POST   | 201         | Add review comment         | `{comment, role}`                    | `{status: true, data: submission, message, timestamp}`                                     | MoSPI-level comments    | Adds MoSPI reviewer comment        |
| `/submission/approve/:id`             | POST   | 200         | Approve submission         | `{comment?}`                         | `{status: true, data: submission, message, timestamp}`                                     | Final approval workflow | Approves submission                |
| `/submission/final-reject/:id`        | POST   | 200         | Final rejection            | `{comment, reason}`                  | `{status: true, data: submission, message, timestamp}`                                     | REJECTED_FINAL status   | Final rejection                    |
| `/users`                              | GET    | 200         | List users                 | Query: `?page=1&limit=20`            | `{status: true, data: users, message, timestamp}`                                          | All users visible       | Returns all users                  |
| `/users/:id`                          | GET    | 200         | Get specific user          | None                                 | `{status: true, data: user, message, timestamp}`                                           | User details available  | Returns user details               |
| `/users/:id`                          | PATCH  | 200         | Update user                | `{firstName?, lastName?, isActive?}` | `{status: true, data: user, message, timestamp}`                                           | User management         | Updates user info                  |
| `/users/:id`                          | DELETE | 200         | Delete user                | None                                 | `{status: true, data: null, message, timestamp}`                                           | User deletion           | Soft deletes user                  |
| `/audit`                              | GET    | 200         | Audit logs                 | Query: `?page=1&limit=20`            | `{status: true, data: {logs, total}, message, timestamp}`                                  | All audit entries       | Returns audit logs                 |
| `/audit/entity/:entityType/:entityId` | GET    | 200         | Entity audit logs          | None                                 | `{status: true, data: logs, message, timestamp}`                                           | Entity-specific logs    | Returns entity audit logs          |
| `/audit/user/:userId`                 | GET    | 200         | User audit logs            | None                                 | `{status: true, data: logs, message, timestamp}`                                           | User-specific logs      | Returns user audit logs            |
| `/audit/stats`                        | GET    | 200         | Audit statistics           | None                                 | `{status: true, data: {totalLogs, etc}, message, timestamp}`                               | Audit metrics           | Returns audit statistics           |
| `/audit/my-activity`                  | GET    | 200         | My activity logs           | None                                 | `{status: true, data: logs, message, timestamp}`                                           | Personal audit trail    | Returns user's activity            |
| `/report/ranking`                     | GET    | 200         | State ranking report       | Query: `?year?&stateUt?`             | `{status: true, data: rankings, message, timestamp}`                                       | Ranking data            | Returns state rankings             |
| `/report/full-report`                 | GET    | 200         | Full report                | Query: `?year?&format?`              | `{status: true, data: {rankings, statistics, stateComparison}, message, timestamp}`        | Comprehensive report    | Returns full report                |
| `/report/state/:stateUt`              | GET    | 200         | State-specific report      | None                                 | `{status: true, data: {stateData, submissions, scores}, message, timestamp}`               | State-wise reports      | Returns state-specific report      |
| `/report/export`                      | GET    | 200         | Export report              | Query: `?format=xlsx&year?`          | File download                                                                              | Report export           | Exports report in specified format |
| `/report/submission-status`           | GET    | 200         | Submission status report   | None                                 | `{status: true, data: {statusCounts}, message, timestamp}`                                 | Status-wise reports     | Returns submission status counts   |
| `/file/storage-info`                  | GET    | 200         | File storage info          | None                                 | `{status: true, data: {storageType, message}, message, timestamp}`                         | Storage configuration   | Returns storage configuration      |
| `/auth/profile`                       | GET    | 200         | Get user profile           | None                                 | `{status: true, data: user, message, timestamp}`                                           | Profile data available  | Returns current user's profile     |
| `/auth/change-password`               | PUT    | 200         | Change password            | `{currentPassword, newPassword}`     | `{status: true, data: null, message, timestamp}`                                           | Password update working | Updates user password              |
| `/dashboard/summary`                  | GET    | 200         | Dashboard summary          | None                                 | `{status: true, data: {pendingSubmissions, approvedSubmissions, etc}, message, timestamp}` | MoSPI-level metrics     | Returns MoSPI-level dashboard      |
| `/dashboard/kpis`                     | GET    | 200         | Key Performance Indicators | None                                 | `{status: true, data: {mySubmissions, pendingReview, etc}, message, timestamp}`            | MoSPI KPIs              | Returns MoSPI-level KPIs           |

**Test Data Available:**

- **Users**: MoSPI Reviewers available
- **Submissions**: Submissions in SUBMITTED_TO_MOSPI status
- **Reports**: Ranking and comprehensive reports
- **Audit Logs**: Complete audit trail
- **File Management**: Storage configuration

---

### ✅ **MOSPI_APPROVER Role APIs**

| Endpoint                              | Method | Status Code | Description                | Request Body                         | Response Format                                                                            | Test Data Available       | Notes                              |
| ------------------------------------- | ------ | ----------- | -------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------- | ---------------------------------- |
| `/submission`                         | GET    | 200         | List submissions           | Query: `?page=1&limit=20&status?`    | `{status: true, data: {submissions, total}, message, timestamp}`                           | All submissions visible   | Returns all submissions            |
| `/submission/:id`                     | GET    | 200         | Get specific submission    | None                                 | `{status: true, data: submission, message, timestamp}`                                     | Full submission details   | Returns submission with details    |
| `/submission/approve/:id`             | POST   | 200         | Final approval             | `{comment?}`                         | `{status: true, data: submission, message, timestamp}`                                     | APPROVED status + scoring | Final approval with scoring        |
| `/submission/final-reject/:id`        | POST   | 200         | Final rejection            | `{comment, reason}`                  | `{status: true, data: submission, message, timestamp}`                                     | REJECTED_FINAL status     | Final rejection                    |
| `/submission/:id/comment`             | POST   | 201         | Add review comment         | `{comment, role}`                    | `{status: true, data: submission, message, timestamp}`                                     | Final-level comments      | Adds MoSPI approver comment        |
| `/users`                              | GET    | 200         | List users                 | Query: `?page=1&limit=20`            | `{status: true, data: users, message, timestamp}`                                          | All users visible         | Returns all users                  |
| `/users/:id`                          | GET    | 200         | Get specific user          | None                                 | `{status: true, data: user, message, timestamp}`                                           | User details available    | Returns user details               |
| `/users/:id`                          | PATCH  | 200         | Update user                | `{firstName?, lastName?, isActive?}` | `{status: true, data: user, message, timestamp}`                                           | User management           | Updates user info                  |
| `/users/:id`                          | DELETE | 200         | Delete user                | None                                 | `{status: true, data: null, message, timestamp}`                                           | User deletion             | Soft deletes user                  |
| `/audit`                              | GET    | 200         | Audit logs                 | Query: `?page=1&limit=20`            | `{status: true, data: {logs, total}, message, timestamp}`                                  | All audit entries         | Returns audit logs                 |
| `/audit/entity/:entityType/:entityId` | GET    | 200         | Entity audit logs          | None                                 | `{status: true, data: logs, message, timestamp}`                                           | Entity-specific logs      | Returns entity audit logs          |
| `/audit/user/:userId`                 | GET    | 200         | User audit logs            | None                                 | `{status: true, data: logs, message, timestamp}`                                           | User-specific logs        | Returns user audit logs            |
| `/audit/stats`                        | GET    | 200         | Audit statistics           | None                                 | `{status: true, data: {totalLogs, etc}, message, timestamp}`                               | Audit metrics             | Returns audit statistics           |
| `/audit/my-activity`                  | GET    | 200         | My activity logs           | None                                 | `{status: true, data: logs, message, timestamp}`                                           | Personal audit trail      | Returns user's activity            |
| `/report/ranking`                     | GET    | 200         | State ranking report       | Query: `?year?&stateUt?`             | `{status: true, data: rankings, message, timestamp}`                                       | Ranking data              | Returns state rankings             |
| `/report/full-report`                 | GET    | 200         | Full report                | Query: `?year?&format?`              | `{status: true, data: {rankings, statistics, stateComparison}, message, timestamp}`        | Comprehensive report      | Returns full report                |
| `/report/state/:stateUt`              | GET    | 200         | State-specific report      | None                                 | `{status: true, data: {stateData, submissions, scores}, message, timestamp}`               | State-wise reports        | Returns state-specific report      |
| `/report/export`                      | GET    | 200         | Export report              | Query: `?format=xlsx&year?`          | File download                                                                              | Report export             | Exports report in specified format |
| `/report/submission-status`           | GET    | 200         | Submission status report   | None                                 | `{status: true, data: {statusCounts}, message, timestamp}`                                 | Status-wise reports       | Returns submission status counts   |
| `/file/storage-info`                  | GET    | 200         | File storage info          | None                                 | `{status: true, data: {storageType, message}, message, timestamp}`                         | Storage configuration     | Returns storage configuration      |
| `/file/upload/:submissionId`          | POST   | 201         | Upload file                | FormData with file                   | `{status: true, data: {fileName, fileUrl, fileSize}, message, timestamp}`                  | File upload working       | Uploads file for submission        |
| `/file/upload-multiple/:submissionId` | POST   | 201         | Upload multiple files      | FormData with files                  | `{status: true, data: [{fileName, fileUrl, fileSize}], message, timestamp}`                | Multiple file upload      | Uploads multiple files             |
| `/file/:filePath`                     | DELETE | 200         | Delete file                | None                                 | `{status: true, data: {success: boolean}, message, timestamp}`                             | File deletion             | Deletes file from storage          |
| `/file/url/:filePath`                 | GET    | 200         | Get file URL               | None                                 | `{status: true, data: {fileUrl}, message, timestamp}`                                      | File URL generation       | Returns file access URL            |
| `/auth/profile`                       | GET    | 200         | Get user profile           | None                                 | `{status: true, data: user, message, timestamp}`                                           | Profile data available    | Returns current user's profile     |
| `/auth/change-password`               | PUT    | 200         | Change password            | `{currentPassword, newPassword}`     | `{status: true, data: null, message, timestamp}`                                           | Password update working   | Updates user password              |
| `/dashboard/summary`                  | GET    | 200         | Dashboard summary          | None                                 | `{status: true, data: {pendingSubmissions, approvedSubmissions, etc}, message, timestamp}` | MoSPI-level metrics       | Returns MoSPI-level dashboard      |
| `/dashboard/kpis`                     | GET    | 200         | Key Performance Indicators | None                                 | `{status: true, data: {mySubmissions, pendingReview, etc}, message, timestamp}`            | MoSPI KPIs                | Returns MoSPI-level KPIs           |

**Test Data Available:**

- **Users**: MoSPI Approvers available
- **Submissions**: Submissions ready for final approval
- **Scoring**: Automatic scoring on approval
- **Final Scores**: Calculated scores stored
- **Reports**: Complete reporting system
- **File Management**: Full file upload/download system

---

## 📊 **Status Codes Summary**

| Status Code | Meaning               | Usage                               | Frontend Action            |
| ----------- | --------------------- | ----------------------------------- | -------------------------- |
| 200         | OK                    | Successful GET, PATCH, PUT requests | Process data normally      |
| 201         | Created               | Successful POST requests            | Show success message       |
| 400         | Bad Request           | Validation errors                   | Show validation errors     |
| 401         | Unauthorized          | Missing/invalid JWT token           | Redirect to login          |
| 403         | Forbidden             | Role-based access denied            | Show access denied message |
| 404         | Not Found             | Resource not found                  | Show not found message     |
| 409         | Conflict              | Business rule violations            | Show conflict message      |
| 422         | Unprocessable Entity  | Field validation errors             | Show field errors          |
| 500         | Internal Server Error | Server errors                       | Show generic error message |

---

## 🎯 **Response Format**

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

## 📈 **Test Data Summary**

### **Users Created**

- **Total**: 27+ users across all roles
- **Nodal Officers**: 10+ (Maharashtra, Karnataka, Tamil Nadu, Gujarat)
- **State Approvers**: 8+ (All states)
- **MoSPI Reviewers**: 4+ (Central, Maharashtra)
- **MoSPI Approvers**: 3+ (Central, Maharashtra)

### **Submissions Created**

- **Total**: 7 submissions
- **Statuses**: DRAFT, SUBMITTED_TO_STATE, SUBMITTED_TO_MOSPI, APPROVED, REJECTED_TO_STATE, REJECTED_FINAL
- **Form Data**: Infrastructure metrics, budget allocation, project details
- **Comments**: Review comments at all levels
- **Files**: File upload/download system

### **Database Tables**

- **users**: 27+ users with realistic data
- **submissions**: 7 submissions with different statuses
- **audit_logs**: Complete audit trail
- **final_scores**: Scoring data for approved submissions

---

## 🚀 **Ready for Frontend Integration**

**All APIs are fully functional with comprehensive test data!**

- 🎯 **40+ Endpoints** working across all roles
- 🎯 **27+ Users** with realistic data
- 🎯 **7+ Submissions** with different statuses
- 🎯 **Complete Workflow** from creation to approval
- 🎯 **Role-Based Security** properly enforced
- 🎯 **Consistent Response Format** across all endpoints

**Frontend team can now integrate with confidence using any role and accessing all functionalities!** 🎉✨
