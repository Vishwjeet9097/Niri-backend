# NIRI API Error Handling Guide

## 🚨 Error Response Format

सभी API errors एक standardized format में return होती हैं:

```json
{
  "status": false,
  "data": null,
  "message": "Human readable error message",
  "error": "Error type/code",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/endpoint",
  "method": "GET"
}
```

## 📋 Error Types और Messages

### 1. Database Errors

#### Table Not Found

```json
{
  "status": false,
  "data": null,
  "message": "Database table not found. Please run database migration first.",
  "error": "Database Schema Error",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/users",
  "method": "GET"
}
```

#### Database Connection Failed

```json
{
  "status": false,
  "data": null,
  "message": "Database connection failed. Please try again later.",
  "error": "Database Connection Error",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/auth/login",
  "method": "POST"
}
```

#### No Users Found

```json
{
  "status": false,
  "data": null,
  "message": "No users found in database. Please run database migration to create default users.",
  "error": "Service Unavailable",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/auth/login",
  "method": "POST"
}
```

### 2. Authentication Errors

#### Invalid Credentials

```json
{
  "status": false,
  "data": null,
  "message": "Invalid credentials",
  "error": "Unauthorized",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/auth/login",
  "method": "POST"
}
```

#### Account Deactivated

```json
{
  "status": false,
  "data": null,
  "message": "Account is deactivated",
  "error": "Unauthorized",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/auth/login",
  "method": "POST"
}
```

#### User Not Found

```json
{
  "status": false,
  "data": null,
  "message": "User not found",
  "error": "Not Found",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/users/123",
  "method": "GET"
}
```

### 3. Authorization Errors

#### Access Denied

```json
{
  "status": false,
  "data": null,
  "message": "Access denied",
  "error": "Forbidden",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/submissions",
  "method": "GET"
}
```

#### Invalid Role

```json
{
  "status": false,
  "data": null,
  "message": "Only Nodal Officers can create submissions",
  "error": "Forbidden",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/submissions",
  "method": "POST"
}
```

### 4. Validation Errors

#### Missing Required Fields

```json
{
  "status": false,
  "data": null,
  "message": "Status is required in payload",
  "error": "Bad Request",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/submissions/approve",
  "method": "POST"
}
```

#### Invalid Data

```json
{
  "status": false,
  "data": null,
  "message": "Submission ID already exists",
  "error": "Bad Request",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/submissions",
  "method": "POST"
}
```

### 5. Business Logic Errors

#### Invalid Status Transition

```json
{
  "status": false,
  "data": null,
  "message": "Submission must be in draft status to submit to state",
  "error": "Bad Request",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/submissions/submit-to-state",
  "method": "POST"
}
```

#### Resource Not Found

```json
{
  "status": false,
  "data": null,
  "message": "Submission not found",
  "error": "Not Found",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/submissions/123",
  "method": "GET"
}
```

## 🔧 Error Handling Features

### 1. Global Exception Filter

- सभी unhandled exceptions को catch करता है
- Database errors को user-friendly messages में convert करता है
- Development mode में stack traces include करता है

### 2. Database Health Checks

- Login से पहले database connection verify करता है
- Required tables की existence check करता है
- User count verify करता है

### 3. Comprehensive Error Messages

- Technical errors को business-friendly language में convert करता है
- Actionable suggestions provide करता है
- Clear next steps suggest करता है

### 4. Consistent Response Format

- सभी errors एक ही format में return होती हैं
- Timestamp और request details include करती हैं
- Status codes properly set करती हैं

## 🚀 Testing Error Scenarios

### 1. Database Not Connected

```bash
# Stop database और API call करें
curl -X GET http://localhost:3000/health
```

### 2. Tables Not Found

```bash
# Database में tables create न करें और API call करें
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

### 3. Invalid Credentials

```bash
# Wrong credentials के साथ login करें
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"wrong@example.com","password":"wrong"}'
```

### 4. Unauthorized Access

```bash
# Without token API call करें
curl -X GET http://localhost:3000/submissions
```

## 📊 Error Monitoring

### 1. Logs

- सभी errors properly logged होती हैं
- Stack traces development mode में available हैं
- Request context include होता है

### 2. Health Check

```bash
curl -X GET http://localhost:3000/health
```

Response:

```json
{
  "status": true,
  "data": {
    "service": "NIRI Backend API",
    "database": {
      "connected": true,
      "tables": 4,
      "requiredTables": ["users", "submissions", "audit_logs", "final_scores"],
      "foundTables": ["users", "submissions", "audit_logs", "final_scores"]
    }
  },
  "message": "Health check successful"
}
```

## ✅ Best Practices

1. **Always check health endpoint first** - Database connectivity verify करें
2. **Handle errors gracefully** - User-friendly messages provide करें
3. **Log errors properly** - Debugging के लिए detailed logs maintain करें
4. **Provide actionable feedback** - Users को clear next steps suggest करें
5. **Test error scenarios** - Different error conditions test करें

## 🔍 Common Error Scenarios

| Scenario               | Error Message                                                                        | Solution                    |
| ---------------------- | ------------------------------------------------------------------------------------ | --------------------------- |
| Database not connected | "Database connection failed. Please try again later."                                | Check database service      |
| Tables missing         | "Database table not found. Please run database migration first."                     | Run `npm run db:migrate`    |
| No users found         | "No users found in database. Please run database migration to create default users." | Run `npm run db:seed`       |
| Invalid credentials    | "Invalid credentials"                                                                | Check email/password        |
| Access denied          | "Access denied"                                                                      | Check user role/permissions |
| Resource not found     | "Resource not found"                                                                 | Check resource ID           |
| Invalid status         | "Invalid status transition"                                                          | Check business rules        |

सभी APIs में comprehensive error handling implement की गई है!
