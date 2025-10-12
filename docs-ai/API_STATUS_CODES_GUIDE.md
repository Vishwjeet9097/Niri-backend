# NIRI Backend API - Complete Status Codes Guide

## 🎯 Overview

NIRI Backend API uses standard HTTP status codes to indicate the success or failure of API requests. Each response includes a `status` field (boolean) and appropriate HTTP status code.

## 📊 Complete Status Codes Reference

### ✅ Success Status Codes (2xx)

| Status Code | HTTP Status | Meaning                         | When Used                              | Response Format                                                |
| ----------- | ----------- | ------------------------------- | -------------------------------------- | -------------------------------------------------------------- |
| **200**     | OK          | Request successful              | GET, PATCH, PUT operations             | `{status: true, data: {...}, message: "..."}`                  |
| **201**     | Created     | Resource created successfully   | POST operations (new resources)        | `{status: true, data: {...}, message: "Created successfully"}` |
| **202**     | Accepted    | Request accepted for processing | Async operations, workflow transitions | `{status: true, data: {...}, message: "Request accepted"}`     |

**Examples:**

```json
// 200 OK - Get submission
{
  "status": true,
  "data": {
    "id": "uuid",
    "submissionId": "SUB-001",
    "status": "DRAFT"
  },
  "message": "Submission retrieved successfully",
  "timestamp": "2025-10-10T19:37:11.495Z"
}

// 201 Created - Create submission
{
  "status": true,
  "data": {
    "id": "uuid",
    "submissionId": "SUB-002",
    "status": "DRAFT"
  },
  "message": "Submission created successfully",
  "timestamp": "2025-10-10T19:37:11.495Z"
}
```

### ❌ Client Error Status Codes (4xx)

| Status Code | HTTP Status          | Meaning                 | When Used                                   | Response Format                                                |
| ----------- | -------------------- | ----------------------- | ------------------------------------------- | -------------------------------------------------------------- |
| **400**     | Bad Request          | Invalid request data    | Validation errors, malformed JSON           | `{status: false, message: "Validation error", errors: [...]}`  |
| **401**     | Unauthorized         | Authentication required | Missing/invalid JWT token                   | `{status: false, message: "Authentication required"}`          |
| **403**     | Forbidden            | Access denied           | Insufficient permissions, role restrictions | `{status: false, message: "Access denied"}`                    |
| **404**     | Not Found            | Resource not found      | Invalid ID, non-existent resource           | `{status: false, message: "Resource not found"}`               |
| **409**     | Conflict             | Resource conflict       | Duplicate data, business rule violations    | `{status: false, message: "Conflict occurred"}`                |
| **422**     | Unprocessable Entity | Validation failed       | Field validation errors                     | `{status: false, message: "Validation failed", errors: [...]}` |
| **429**     | Too Many Requests    | Rate limit exceeded     | API rate limiting                           | `{status: false, message: "Rate limit exceeded"}`              |

**Examples:**

```json
// 400 Bad Request - Validation error
{
  "status": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Email must be a valid email address"
    }
  ],
  "timestamp": "2025-10-10T19:37:11.495Z"
}

// 401 Unauthorized - Missing token
{
  "status": false,
  "message": "Authentication required",
  "timestamp": "2025-10-10T19:37:11.495Z"
}

// 403 Forbidden - Role restriction
{
  "status": false,
  "message": "Access denied. Required roles: STATE_APPROVER, MOSPI_REVIEWER",
  "timestamp": "2025-10-10T19:37:11.495Z"
}

// 404 Not Found - Invalid submission ID
{
  "status": false,
  "message": "Submission not found",
  "timestamp": "2025-10-10T19:37:11.495Z"
}
```

### 🔥 Server Error Status Codes (5xx)

| Status Code | HTTP Status           | Meaning       | When Used                              | Response Format                                               |
| ----------- | --------------------- | ------------- | -------------------------------------- | ------------------------------------------------------------- |
| **500**     | Internal Server Error | Server error  | Database errors, unexpected exceptions | `{status: false, message: "Internal server error"}`           |
| **502**     | Bad Gateway           | Gateway error | External service failures              | `{status: false, message: "Service temporarily unavailable"}` |
| **503**     | Service Unavailable   | Service down  | Maintenance, overload                  | `{status: false, message: "Service temporarily unavailable"}` |
| **504**     | Gateway Timeout       | Timeout error | External service timeouts              | `{status: false, message: "Request timeout"}`                 |

**Examples:**

```json
// 500 Internal Server Error
{
  "status": false,
  "message": "Internal server error",
  "timestamp": "2025-10-10T19:37:11.495Z"
}

// 503 Service Unavailable
{
  "status": false,
  "message": "Service temporarily unavailable",
  "timestamp": "2025-10-10T19:37:11.495Z"
}
```

## 🔍 Endpoint-Specific Status Codes

### Authentication Endpoints

| Endpoint                | Method | Success                 | Error Cases                                                    |
| ----------------------- | ------ | ----------------------- | -------------------------------------------------------------- |
| `/auth/login`           | POST   | 200 (valid credentials) | 401 (invalid credentials), 400 (validation)                    |
| `/auth/register`        | POST   | 201 (user created)      | 400 (validation), 409 (email exists)                           |
| `/auth/profile`         | GET    | 200 (profile data)      | 401 (no token), 404 (user not found)                           |
| `/auth/change-password` | PUT    | 200 (password changed)  | 401 (no token), 400 (validation), 403 (wrong current password) |

### Submission Endpoints

| Endpoint                           | Method | Success                  | Error Cases                                                                               |
| ---------------------------------- | ------ | ------------------------ | ----------------------------------------------------------------------------------------- |
| `/submission`                      | POST   | 201 (submission created) | 400 (validation), 401 (no token), 403 (wrong role)                                        |
| `/submission`                      | GET    | 200 (list retrieved)     | 401 (no token), 403 (access denied)                                                       |
| `/submission/:id`                  | GET    | 200 (submission found)   | 401 (no token), 403 (access denied), 404 (not found)                                      |
| `/submission/:id`                  | PATCH  | 200 (updated)            | 400 (validation), 401 (no token), 403 (access denied), 404 (not found)                    |
| `/submission/submit-to-state/:id`  | POST   | 200 (submitted)          | 400 (wrong status), 401 (no token), 403 (wrong role), 404 (not found)                     |
| `/submission/forward-to-mospi/:id` | POST   | 200 (forwarded)          | 400 (wrong status), 401 (no token), 403 (wrong role), 404 (not found), 500 (server error) |
| `/submission/state-reject/:id`     | POST   | 200 (rejected)           | 400 (validation), 401 (no token), 403 (wrong role), 404 (not found)                       |
| `/submission/final-reject/:id`     | POST   | 200 (rejected)           | 400 (validation), 401 (no token), 403 (wrong role), 404 (not found)                       |
| `/submission/approve/:id`          | POST   | 200 (approved)           | 400 (wrong status), 401 (no token), 403 (wrong role), 404 (not found)                     |
| `/submission/resubmit/:id`         | POST   | 200 (resubmitted)        | 400 (validation), 401 (no token), 403 (wrong role), 404 (not found)                       |

### Dashboard & Reports

| Endpoint              | Method | Success              | Error Cases                         |
| --------------------- | ------ | -------------------- | ----------------------------------- |
| `/dashboard/summary`  | GET    | 200 (data retrieved) | 401 (no token), 403 (access denied) |
| `/dashboard/kpis`     | GET    | 200 (KPIs retrieved) | 401 (no token), 403 (access denied) |
| `/report/ranking`     | GET    | 200 (ranking data)   | 401 (no token), 403 (wrong role)    |
| `/report/full-report` | GET    | 200 (report data)    | 401 (no token), 403 (wrong role)    |

### File Management

| Endpoint                     | Method | Success             | Error Cases                                                                        |
| ---------------------------- | ------ | ------------------- | ---------------------------------------------------------------------------------- |
| `/file/upload/:submissionId` | POST   | 201 (file uploaded) | 400 (validation), 401 (no token), 404 (submission not found), 413 (file too large) |
| `/file/:filePath`            | DELETE | 200 (file deleted)  | 401 (no token), 404 (file not found), 403 (access denied)                          |
| `/file/url/:filePath`        | GET    | 200 (URL generated) | 401 (no token), 404 (file not found), 403 (access denied)                          |

### User Management

| Endpoint     | Method | Success            | Error Cases                                                                      |
| ------------ | ------ | ------------------ | -------------------------------------------------------------------------------- |
| `/users`     | GET    | 200 (users list)   | 401 (no token), 403 (access denied)                                              |
| `/users/:id` | GET    | 200 (user found)   | 401 (no token), 403 (access denied), 404 (not found)                             |
| `/users/:id` | PATCH  | 200 (user updated) | 400 (validation), 401 (no token), 403 (access denied), 404 (not found)           |
| `/users/:id` | DELETE | 200 (user deleted) | 401 (no token), 403 (access denied), 404 (not found), 409 (user has submissions) |

### Audit Logs

| Endpoint                              | Method | Success           | Error Cases                                          |
| ------------------------------------- | ------ | ----------------- | ---------------------------------------------------- |
| `/audit`                              | GET    | 200 (audit logs)  | 401 (no token), 403 (access denied)                  |
| `/audit/entity/:entityType/:entityId` | GET    | 200 (entity logs) | 401 (no token), 403 (access denied), 404 (not found) |
| `/audit/user/:userId`                 | GET    | 200 (user logs)   | 401 (no token), 403 (access denied), 404 (not found) |

## 🚀 Frontend Handling Patterns

### 1. Success Response Handling

```typescript
// Handle successful responses
const handleSuccess = (response: any) => {
  if (response.status === 200 || response.status === 201) {
    if (response.data.status) {
      // Process successful data
      const data = response.data.data;
      const message = response.data.message;

      // Show success message to user
      showToast(message, 'success');

      return data;
    }
  }
  return null;
};
```

### 2. Error Response Handling

```typescript
// Handle error responses
const handleError = (error: any) => {
  const status = error.response?.status;
  const responseData = error.response?.data;

  switch (status) {
    case 400:
      // Bad Request - Show validation errors
      if (responseData?.errors) {
        responseData.errors.forEach((err: any) => {
          showToast(`${err.field}: ${err.message}`, 'error');
        });
      } else {
        showToast(responseData?.message || 'Invalid request', 'error');
      }
      break;

    case 401:
      // Unauthorized - Redirect to login
      showToast('Please login again', 'error');
      redirectToLogin();
      break;

    case 403:
      // Forbidden - Show access denied
      showToast(responseData?.message || 'Access denied', 'error');
      break;

    case 404:
      // Not Found - Show not found message
      showToast(responseData?.message || 'Resource not found', 'error');
      break;

    case 409:
      // Conflict - Show conflict message
      showToast(responseData?.message || 'Conflict occurred', 'error');
      break;

    case 422:
      // Validation Error - Show validation errors
      if (responseData?.errors) {
        responseData.errors.forEach((err: any) => {
          showToast(`${err.field}: ${err.message}`, 'error');
        });
      }
      break;

    case 429:
      // Rate Limited - Show rate limit message
      showToast('Too many requests. Please try again later.', 'error');
      break;

    case 500:
      // Server Error - Show generic error
      showToast('Server error. Please try again later.', 'error');
      break;

    case 503:
      // Service Unavailable - Show maintenance message
      showToast('Service temporarily unavailable', 'error');
      break;

    default:
      // Network or unknown error
      showToast('An unexpected error occurred', 'error');
      break;
  }
};
```

### 3. Complete API Client with Status Handling

```typescript
import axios, { AxiosResponse, AxiosError } from 'axios';

class ApiClient {
  private client = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  });

  constructor() {
    // Request interceptor for auth
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('jwt_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: AxiosError) => {
        this.handleError(error);
        return Promise.reject(error);
      },
    );
  }

  private handleError(error: AxiosError) {
    const status = error.response?.status;
    const responseData = error.response?.data as any;

    // Log error for debugging
    console.error(`API Error ${status}:`, responseData);

    // Handle specific status codes
    switch (status) {
      case 401:
        // Clear token and redirect to login
        localStorage.removeItem('jwt_token');
        window.location.href = '/login';
        break;

      case 403:
        // Show access denied message
        this.showError(responseData?.message || 'Access denied');
        break;

      case 404:
        // Show not found message
        this.showError(responseData?.message || 'Resource not found');
        break;

      case 500:
        // Show server error message
        this.showError('Server error. Please try again later.');
        break;

      default:
        // Show generic error message
        this.showError('An unexpected error occurred');
        break;
    }
  }

  private showError(message: string) {
    // Implement your toast/notification system here
    console.error(message);
  }

  // Generic API call method
  async call<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    data?: any,
  ): Promise<T | null> {
    try {
      const response = await this.client.request({
        method,
        url,
        data,
      });

      if (response.data.status) {
        return response.data.data;
      } else {
        this.showError(response.data.message);
        return null;
      }
    } catch (error) {
      // Error is already handled by interceptor
      return null;
    }
  }

  // Specific methods
  async get<T>(url: string): Promise<T | null> {
    return this.call<T>('GET', url);
  }

  async post<T>(url: string, data?: any): Promise<T | null> {
    return this.call<T>('POST', url, data);
  }

  async put<T>(url: string, data?: any): Promise<T | null> {
    return this.call<T>('PUT', url, data);
  }

  async patch<T>(url: string, data?: any): Promise<T | null> {
    return this.call<T>('PATCH', url, data);
  }

  async delete<T>(url: string): Promise<T | null> {
    return this.call<T>('DELETE', url);
  }
}

export default new ApiClient();
```

## 📋 Status Code Summary

### Quick Reference

| Status Range | Category     | Description                                     |
| ------------ | ------------ | ----------------------------------------------- |
| **2xx**      | Success      | Request completed successfully                  |
| **4xx**      | Client Error | Request error (validation, auth, permissions)   |
| **5xx**      | Server Error | Server-side error (database, external services) |

### Most Common Status Codes in NIRI API

1. **200 OK** - Most GET, PATCH operations
2. **201 Created** - User registration, submission creation, file upload
3. **400 Bad Request** - Validation errors, malformed requests
4. **401 Unauthorized** - Missing/invalid JWT token
5. **403 Forbidden** - Role-based access restrictions
6. **404 Not Found** - Invalid resource IDs
7. **500 Internal Server Error** - Database errors, unexpected exceptions

## 🎯 Best Practices

1. **Always check both HTTP status and response.status**
2. **Handle 401 errors by redirecting to login**
3. **Show user-friendly messages for 4xx errors**
4. **Log 5xx errors for debugging**
5. **Implement retry logic for 5xx errors**
6. **Use appropriate loading states for different status codes**

---

**Ready for Production!** 🚀

This comprehensive status code guide ensures your frontend handles all possible API responses correctly and provides excellent user experience.
