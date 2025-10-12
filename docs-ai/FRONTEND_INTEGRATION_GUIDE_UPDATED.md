# NIRI Backend API - Frontend Integration Guide

## 🎯 Updated Response Format

All NIRI Backend APIs now return responses in a consistent format:

```json
{
  "status": true,
  "data": {
    // Actual response data here
  },
  "message": "Descriptive success message",
  "timestamp": "2025-10-10T19:37:11.495Z"
}
```

## 📝 Frontend Changes Required

### 1. API Response Handling

**OLD CODE:**

```javascript
// Direct data access
const response = await api.get('/submission');
const submissions = response.data;
```

**NEW CODE:**

```javascript
// Structured data access
const response = await api.get('/submission');
if (response.data.status) {
  const submissions = response.data.data.submissions;
  const message = response.data.message;
  // Show success message to user
} else {
  // Handle error
}
```

### 2. Authentication Response

**OLD CODE:**

```javascript
const loginResponse = await api.post('/auth/login', credentials);
const token = loginResponse.data.accessToken;
const user = loginResponse.data.user;
```

**NEW CODE:**

```javascript
const loginResponse = await api.post('/auth/login', credentials);
if (loginResponse.data.status) {
  const token = loginResponse.data.data.accessToken;
  const user = loginResponse.data.data.user;
  const message = loginResponse.data.message;
} else {
  // Handle login error
}
```

### 3. Submission Creation

**OLD CODE:**

```javascript
const submissionResponse = await api.post('/submission', submissionData);
const submission = submissionResponse.data;
```

**NEW CODE:**

```javascript
const submissionResponse = await api.post('/submission', submissionData);
if (submissionResponse.data.status) {
  const submission = submissionResponse.data.data;
  const message = submissionResponse.data.message;
  // Show success message
} else {
  // Handle error
}
```

### 4. Error Handling

**OLD CODE:**

```javascript
try {
  const response = await api.get('/submission');
  // Handle success
} catch (error) {
  // Handle error
}
```

**NEW CODE:**

```javascript
try {
  const response = await api.get('/submission');
  if (response.data.status) {
    // Handle success
    const data = response.data.data;
    const message = response.data.message;
  } else {
    // Handle API-level error
    console.error(response.data.message);
  }
} catch (error) {
  // Handle network/system errors
}
```

## 🔧 Updated API Endpoints

### Authentication Endpoints

| Endpoint         | Method | Response Format                                                                      |
| ---------------- | ------ | ------------------------------------------------------------------------------------ |
| `/auth/login`    | POST   | `{status: true, data: {user, accessToken}, message: "Login successful"}`             |
| `/auth/register` | POST   | `{status: true, data: {user, accessToken}, message: "User registered successfully"}` |
| `/auth/profile`  | GET    | `{status: true, data: user, message: "Profile retrieved successfully"}`              |

### Submission Endpoints

| Endpoint                           | Method | Response Format                                                                             |
| ---------------------------------- | ------ | ------------------------------------------------------------------------------------------- |
| `/submission`                      | POST   | `{status: true, data: submission, message: "Submission created successfully"}`              |
| `/submission`                      | GET    | `{status: true, data: {submissions, total}, message: "Submissions retrieved successfully"}` |
| `/submission/:id`                  | GET    | `{status: true, data: submission, message: "Submission retrieved successfully"}`            |
| `/submission/:id`                  | PATCH  | `{status: true, data: submission, message: "Submission updated successfully"}`              |
| `/submission/submit-to-state/:id`  | POST   | `{status: true, data: submission, message: "Submission submitted to state successfully"}`   |
| `/submission/forward-to-mospi/:id` | POST   | `{status: true, data: submission, message: "Submission forwarded to MoSPI successfully"}`   |
| `/submission/state-reject/:id`     | POST   | `{status: true, data: submission, message: "Submission rejected by state successfully"}`    |
| `/submission/final-reject/:id`     | POST   | `{status: true, data: submission, message: "Submission rejected by MoSPI successfully"}`    |
| `/submission/approve/:id`          | POST   | `{status: true, data: submission, message: "Submission approved successfully"}`             |
| `/submission/resubmit/:id`         | POST   | `{status: true, data: submission, message: "Submission resubmitted successfully"}`          |

### Dashboard & Reports

| Endpoint             | Method | Response Format                                                                         |
| -------------------- | ------ | --------------------------------------------------------------------------------------- |
| `/dashboard/summary` | GET    | `{status: true, data: dashboardData, message: "Dashboard data retrieved successfully"}` |
| `/dashboard/kpis`    | GET    | `{status: true, data: kpiData, message: "KPIs retrieved successfully"}`                 |
| `/report/ranking`    | GET    | `{status: true, data: rankingData, message: "Ranking report retrieved successfully"}`   |

### File Management

| Endpoint                     | Method | Response Format                                                         |
| ---------------------------- | ------ | ----------------------------------------------------------------------- |
| `/file/upload/:submissionId` | POST   | `{status: true, data: {files}, message: "File uploaded successfully"}`  |
| `/file/:filePath`            | DELETE | `{status: true, data: {success}, message: "File deleted successfully"}` |

## 🚀 React/Next.js Integration Examples

### 1. API Client Setup

```typescript
// apiClient.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
});

// Request interceptor for auth
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for consistent handling
apiClient.interceptors.response.use(
  (response) => {
    // Response is already in the correct format
    return response;
  },
  (error) => {
    // Handle network errors
    return Promise.reject(error);
  },
);

export default apiClient;
```

### 2. Custom Hook for API Calls

```typescript
// useApi.ts
import { useState, useCallback } from 'react';
import apiClient from './apiClient';

interface ApiResponse<T> {
  status: boolean;
  data: T;
  message: string;
  timestamp: string;
}

export function useApi<T>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callApi = useCallback(
    async (apiCall: () => Promise<{ data: ApiResponse<T> }>): Promise<T | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiCall();

        if (response.data.status) {
          return response.data.data;
        } else {
          setError(response.data.message);
          return null;
        }
      } catch (err) {
        setError('Network error occurred');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { callApi, loading, error };
}
```

### 3. Submission Management Hook

```typescript
// useSubmissions.ts
import { useState, useEffect } from 'react';
import { useApi } from './useApi';
import apiClient from './apiClient';

interface Submission {
  id: string;
  submissionId: string;
  stateUt: string;
  status: string;
  formData: any;
  // ... other fields
}

export function useSubmissions() {
  const { callApi, loading, error } = useApi<{ submissions: Submission[]; total: number }>();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [total, setTotal] = useState(0);

  const fetchSubmissions = async () => {
    const result = await callApi(() => apiClient.get('/submission'));
    if (result) {
      setSubmissions(result.submissions);
      setTotal(result.total);
    }
  };

  const createSubmission = async (submissionData: any) => {
    const result = await callApi(() => apiClient.post('/submission', submissionData));
    if (result) {
      setSubmissions((prev) => [result, ...prev]);
      return result;
    }
    return null;
  };

  const updateSubmission = async (id: string, updateData: any) => {
    const result = await callApi(() => apiClient.patch(`/submission/${id}`, updateData));
    if (result) {
      setSubmissions((prev) => prev.map((sub) => (sub.id === id ? result : sub)));
      return result;
    }
    return null;
  };

  const submitToState = async (id: string) => {
    const result = await callApi(() => apiClient.post(`/submission/submit-to-state/${id}`));
    if (result) {
      setSubmissions((prev) => prev.map((sub) => (sub.id === id ? result : sub)));
      return result;
    }
    return null;
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  return {
    submissions,
    total,
    loading,
    error,
    createSubmission,
    updateSubmission,
    submitToState,
    refreshSubmissions: fetchSubmissions,
  };
}
```

### 4. Component Usage

```typescript
// SubmissionList.tsx
import React from 'react';
import { useSubmissions } from './hooks/useSubmissions';

export function SubmissionList() {
  const {
    submissions,
    loading,
    error,
    submitToState
  } = useSubmissions();

  const handleSubmitToState = async (id: string) => {
    const result = await submitToState(id);
    if (result) {
      // Show success message
      alert('Submission submitted to state successfully!');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>Submissions ({submissions.length})</h2>
      {submissions.map(submission => (
        <div key={submission.id} className="submission-card">
          <h3>{submission.submissionId}</h3>
          <p>Status: {submission.status}</p>
          <p>State: {submission.stateUt}</p>

          {submission.status === 'DRAFT' && (
            <button
              onClick={() => handleSubmitToState(submission.id)}
              className="btn-primary"
            >
              Submit to State
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
```

## 🔍 Error Handling Patterns

### 1. Global Error Handler

```typescript
// errorHandler.ts
export function handleApiError(error: any): string {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  if (error.response?.status === 401) {
    return 'Unauthorized. Please login again.';
  }

  if (error.response?.status === 403) {
    return 'Access denied. Insufficient permissions.';
  }

  if (error.response?.status === 404) {
    return 'Resource not found.';
  }

  return 'An unexpected error occurred.';
}
```

### 2. Toast Notifications

```typescript
// useToast.ts
import { useState } from 'react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 5000);
  };

  return { toasts, showToast };
}
```

## 📊 Status Codes

| Status Code | Meaning      | Frontend Action              |
| ----------- | ------------ | ---------------------------- |
| 200         | Success      | Process `response.data.data` |
| 201         | Created      | Process `response.data.data` |
| 400         | Bad Request  | Show `response.data.message` |
| 401         | Unauthorized | Redirect to login            |
| 403         | Forbidden    | Show access denied message   |
| 404         | Not Found    | Show not found message       |
| 500         | Server Error | Show generic error message   |

## 🎯 Migration Checklist

- [ ] Update all API response handling to use `response.data.data`
- [ ] Add status checks with `response.data.status`
- [ ] Update error handling to use `response.data.message`
- [ ] Update authentication flow to use new format
- [ ] Update submission management to use new format
- [ ] Update dashboard/reporting to use new format
- [ ] Test all API integrations
- [ ] Update TypeScript interfaces
- [ ] Update error boundaries
- [ ] Update loading states

## 🚀 Benefits of New Format

1. **Consistency**: All APIs return the same structure
2. **Better Error Handling**: Clear success/failure indicators
3. **User Feedback**: Descriptive messages for user notifications
4. **Debugging**: Timestamps for better logging
5. **Type Safety**: Better TypeScript support
6. **Maintainability**: Easier to maintain and extend

---

**Ready for Frontend Integration!** 🎉

The NIRI Backend API now provides a consistent, structured response format that makes frontend integration smoother and more maintainable.
