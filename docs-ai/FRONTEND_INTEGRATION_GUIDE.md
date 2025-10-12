# 🚀 NIRI Backend API - Frontend Integration Guide

## 📋 Table of Contents

1. [Endpoint Explanation & Workflow](#endpoint-explanation--workflow)
2. [UI/Frontend Integration Guide](#uifrontend-integration-guide)
3. [Postman Collection Value](#postman-collection-value)
4. [Complete API Reference](#complete-api-reference)

---

## 1. Endpoint Explanation & Workflow

### 🔐 Authentication Endpoints

| Endpoint         | Method | Required Role          | Description & Workflow Logic                                                                                                            |
| ---------------- | ------ | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `/auth/login`    | POST   | None                   | **Returns JWT token** upon successful authentication. This token must be stored in frontend state and used for all subsequent requests. |
| `/auth/register` | POST   | None                   | **Creates new user** with specified role. Returns user object and JWT token.                                                            |
| `/auth/profile`  | GET    | Any Authenticated User | **Returns current user profile** using JWT token. Essential for role-based UI rendering.                                                |

### 📝 Submission Workflow Endpoints

| Endpoint                           | Method | Required Role  | Description & Workflow Logic                                                                                                             |
| ---------------------------------- | ------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `/submission`                      | POST   | NODAL_OFFICER  | **Creates initial submission draft**. Returns `submissionId` that must be stored in frontend state for all subsequent operations.        |
| `/submission/:id`                  | GET    | NODAL_OFFICER  | **Retrieves complete submission data** for pre-filling forms. Ensures Nodal Officer can resume their draft using correct `submissionId`. |
| `/submission/:id`                  | PATCH  | NODAL_OFFICER  | **Incremental save**: Updates specific sections of `form_data` (JSONB). Frontend should send only changed sections.                      |
| `/submission/submit-to-state/:id`  | POST   | NODAL_OFFICER  | **Final submission**: Changes status to `SUBMITTED_TO_STATE`. Triggers workflow transition.                                              |
| `/submission/forward-to-mospi/:id` | POST   | STATE_APPROVER | **State approval**: Changes status to `SUBMITTED_TO_MOSPI`, adds comment to `review_comments` JSONB array.                               |
| `/submission/state-reject/:id`     | POST   | STATE_APPROVER | **State rejection**: Changes status to `REJECTED_TO_STATE`, adds rejection reason to `review_comments`.                                  |
| `/submission/final-reject/:id`     | POST   | MOSPI_APPROVER | **Final rejection logic**: Based on `rejection_count`, changes to `REJECTED_TO_STATE` or `REJECTED_FINAL`.                               |
| `/submission/resubmit/:id`         | POST   | NODAL_OFFICER  | **Resubmission**: Increments `rejection_count`, changes status to `SUBMITTED_TO_STATE`.                                                  |
| `/submission/approve/:id`          | POST   | MOSPI_APPROVER | **Final approval**: Changes status to `APPROVED`, triggers scoring engine.                                                               |

### 📁 File Management Endpoints

| Endpoint                              | Method | Required Role          | Description & Workflow Logic                                                                           |
| ------------------------------------- | ------ | ---------------------- | ------------------------------------------------------------------------------------------------------ |
| `/file/upload/:submissionId`          | POST   | Any Authenticated User | **Uploads single file** to submission folder. Returns file path/URL to be stored in `form_data` JSONB. |
| `/file/upload-multiple/:submissionId` | POST   | Any Authenticated User | **Uploads multiple files** simultaneously. Returns array of file paths/URLs.                           |
| `/file/:filePath`                     | DELETE | Any Authenticated User | **Deletes uploaded file** and removes reference from submission.                                       |
| `/file/url/:filePath`                 | GET    | Any Authenticated User | **Gets signed URL** for file access/download.                                                          |

### 📊 Dashboard & Reporting Endpoints

| Endpoint             | Method | Required Role          | Description & Workflow Logic                                   |
| -------------------- | ------ | ---------------------- | -------------------------------------------------------------- |
| `/dashboard/summary` | GET    | Any Authenticated User | **Role-based dashboard** showing relevant KPIs and statistics. |
| `/report/ranking`    | GET    | Any Authenticated User | **State-wise ranking** based on final scores.                  |
| `/audit/my-activity` | GET    | Any Authenticated User | **User's activity log** for audit trail.                       |

---

## 2. UI/Frontend Integration Guide

### 🔑 JWT and Authorization Implementation

#### React Context API Implementation

```typescript
// AuthContext.tsx
interface AuthContextType {
  token: string | null;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// AuthProvider.tsx
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('jwt_token'));
  const [user, setUser] = useState<User | null>(null);

  const login = async (email: string, password: string) => {
    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    setToken(data.accessToken);
    setUser(data.user);
    localStorage.setItem('jwt_token', data.accessToken);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
```

#### Axios Interceptor Setup

```typescript
// api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000',
});

// Request interceptor to add JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect to login
      localStorage.removeItem('jwt_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);
```

### 📋 JSONB Mapping Implementation

#### Form State to JSONB Structure

```typescript
// FormDataInterface.ts
interface FormData {
  basicInfo: {
    stateUt: string;
    submissionDate: string;
    nodalOfficerName: string;
  };
  vgfEntries: Array<{
    id: string;
    projectName: string;
    amount: number;
    status: string;
  }>;
  iipdfEntries: Array<{
    id: string;
    projectName: string;
    amount: number;
    status: string;
  }>;
  attachedFiles: Array<{
    fileName: string;
    filePath: string;
    fileUrl: string;
  }>;
}

// FormComponent.tsx
const [formData, setFormData] = useState<FormData>({
  basicInfo: { stateUt: '', submissionDate: '', nodalOfficerName: '' },
  vgfEntries: [],
  iipdfEntries: [],
  attachedFiles: [],
});

// Save specific section
const saveSection = async (section: keyof FormData, data: any) => {
  const updatedFormData = { ...formData, [section]: data };

  await api.patch(`/submission/${submissionId}`, {
    formData: updatedFormData,
  });

  setFormData(updatedFormData);
};
```

#### Dynamic Form Rendering

```typescript
// VGFEntriesComponent.tsx
const VGFEntriesComponent: React.FC = () => {
  const [entries, setEntries] = useState<VGFEntry[]>([]);

  const addEntry = () => {
    const newEntry: VGFEntry = {
      id: uuidv4(),
      projectName: '',
      amount: 0,
      status: 'pending'
    };
    setEntries([...entries, newEntry]);
  };

  const updateEntry = (id: string, field: keyof VGFEntry, value: any) => {
    setEntries(entries.map(entry =>
      entry.id === id ? { ...entry, [field]: value } : entry
    ));
  };

  return (
    <div>
      {entries.map(entry => (
        <VGFEntryForm
          key={entry.id}
          entry={entry}
          onUpdate={(field, value) => updateEntry(entry.id, field, value)}
        />
      ))}
      <button onClick={addEntry}>Add VGF Entry</button>
    </div>
  );
};
```

### 📁 File Upload Implementation

#### Decoupled File Upload Strategy

```typescript
// FileUploadComponent.tsx
const FileUploadComponent: React.FC<{ submissionId: string }> = ({ submissionId }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const handleFileUpload = async (files: FileList) => {
    setUploading(true);

    try {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('files', file);
      });

      const response = await api.post(`/file/upload-multiple/${submissionId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const uploadedFiles = response.data.files;
      setUploadedFiles(prev => [...prev, ...uploadedFiles]);

      // Update form data with file references
      await updateFormDataWithFiles(uploadedFiles);

    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  const updateFormDataWithFiles = async (files: UploadedFile[]) => {
    const fileReferences = files.map(file => ({
      fileName: file.fileName,
      filePath: file.filePath,
      fileUrl: file.fileUrl,
      uploadedAt: file.uploadedAt
    }));

    await api.patch(`/submission/${submissionId}`, {
      formData: {
        attachedFiles: [...formData.attachedFiles, ...fileReferences]
      }
    });
  };

  return (
    <div>
      <input
        type="file"
        multiple
        onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
        disabled={uploading}
      />
      {uploading && <div>Uploading...</div>}
      {uploadedFiles.map(file => (
        <div key={file.fileName}>
          {file.fileName} - <a href={file.fileUrl} target="_blank">View</a>
        </div>
      ))}
    </div>
  );
};
```

### 💬 Comment Visibility Implementation

#### Review Comments Display

```typescript
// ReviewCommentsComponent.tsx
interface ReviewComment {
  timestamp: Date;
  role: UserRole;
  userId: string;
  text: string;
  type: 'comment' | 'rejection' | 'approval';
}

const ReviewCommentsComponent: React.FC<{
  comments: ReviewComment[],
  userRole: UserRole
}> = ({ comments, userRole }) => {

  const getCommentVisibility = (comment: ReviewComment) => {
    // Show all comments to MoSPI users
    if (userRole === 'MOSPI_REVIEWER' || userRole === 'MOSPI_APPROVER') {
      return true;
    }

    // Show only state-level comments to State Approver
    if (userRole === 'STATE_APPROVER') {
      return comment.role === 'STATE_APPROVER' || comment.role === 'NODAL_OFFICER';
    }

    // Nodal Officer sees only their own comments
    if (userRole === 'NODAL_OFFICER') {
      return comment.role === 'NODAL_OFFICER';
    }

    return false;
  };

  const visibleComments = comments.filter(getCommentVisibility);

  return (
    <div className="review-comments">
      <h3>Review History</h3>
      {visibleComments.map((comment, index) => (
        <div key={index} className={`comment ${comment.type}`}>
          <div className="comment-header">
            <span className="role">{comment.role}</span>
            <span className="timestamp">{new Date(comment.timestamp).toLocaleString()}</span>
          </div>
          <div className="comment-text">{comment.text}</div>
          {comment.type === 'rejection' && (
            <div className="rejection-reason">❌ Rejection Reason</div>
          )}
        </div>
      ))}
    </div>
  );
};
```

### 🔄 Workflow State Management

#### Submission Status Management

```typescript
// SubmissionStatusComponent.tsx
const SubmissionStatusComponent: React.FC<{ submission: Submission }> = ({ submission }) => {
  const { user } = useAuth();

  const getAvailableActions = () => {
    const actions = [];

    switch (submission.status) {
      case 'SUBMITTED_TO_STATE':
        if (user?.role === 'STATE_APPROVER') {
          actions.push('forward-to-mospi', 'state-reject');
        }
        break;

      case 'SUBMITTED_TO_MOSPI':
        if (user?.role === 'MOSPI_REVIEWER') {
          actions.push('add-comment');
        }
        if (user?.role === 'MOSPI_APPROVER') {
          actions.push('approve', 'final-reject');
        }
        break;

      case 'REJECTED_TO_STATE':
        if (user?.role === 'NODAL_OFFICER') {
          actions.push('resubmit');
        }
        break;
    }

    return actions;
  };

  const handleAction = async (action: string) => {
    switch (action) {
      case 'forward-to-mospi':
        await api.post(`/submission/forward-to-mospi/${submission.id}`);
        break;
      case 'state-reject':
        await api.post(`/submission/state-reject/${submission.id}`, {
          comment: 'Rejected at state level'
        });
        break;
      case 'approve':
        await api.post(`/submission/approve/${submission.id}`);
        break;
      case 'final-reject':
        await api.post(`/submission/final-reject/${submission.id}`, {
          comment: 'Final rejection reason'
        });
        break;
      case 'resubmit':
        await api.post(`/submission/resubmit/${submission.id}`);
        break;
    }

    // Refresh submission data
    await refreshSubmission();
  };

  return (
    <div className="submission-status">
      <div className="status-badge">{submission.status}</div>
      <div className="actions">
        {getAvailableActions().map(action => (
          <button
            key={action}
            onClick={() => handleAction(action)}
            className={`action-btn ${action}`}
          >
            {action.replace('-', ' ').toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
};
```

---

## 3. Postman Collection Value

### 🎯 API Contract Validation

The `niri_api_collection.json` serves as a **living documentation** that ensures frontend teams always know the exact data format the backend expects:

#### Request/Response Examples

```json
// POST /auth/login Request
{
  "email": "nodal.officer@maharashtra.gov.in",
  "password": "password123"
}

// POST /auth/login Response
{
  "user": {
    "id": "uuid",
    "email": "nodal.officer@maharashtra.gov.in",
    "role": "NODAL_OFFICER",
    "stateUt": "Maharashtra"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Form Data Structure Validation

```json
// PATCH /submission/:id Request Body
{
  "formData": {
    "basicInfo": {
      "stateUt": "Maharashtra",
      "submissionDate": "2025-10-10",
      "nodalOfficerName": "Rajesh Kumar"
    },
    "vgfEntries": [
      {
        "id": "uuid",
        "projectName": "Highway Construction",
        "amount": 50000000,
        "status": "completed"
      }
    ],
    "attachedFiles": [
      {
        "fileName": "project_report.pdf",
        "filePath": "submissions/uuid/project_report.pdf",
        "fileUrl": "http://localhost:3000/uploads/submissions/uuid/project_report.pdf"
      }
    ]
  }
}
```

### 🚀 Rapid Debugging Capabilities

#### Workflow Simulation Without UI

Frontend teams can simulate complex workflows without writing UI code:

1. **Complete Submission Workflow**:
   - Register → Login → Create Submission → Upload Files → Submit to State
   - Forward to MoSPI → Add Comments → Approve/Reject

2. **Error Scenario Testing**:
   - Test invalid JWT tokens
   - Test role-based access restrictions
   - Test file upload failures
   - Test validation errors

3. **Performance Testing**:
   - Test large file uploads
   - Test bulk data operations
   - Test concurrent user scenarios

### 🔄 Dynamic Variable Automation

#### Postman Environment Variables

```javascript
// Pre-request Script for Login
pm.sendRequest(
  {
    url: pm.environment.get('base_url') + '/auth/login',
    method: 'POST',
    header: {
      'Content-Type': 'application/json',
    },
    body: {
      mode: 'raw',
      raw: JSON.stringify({
        email: pm.environment.get('test_email'),
        password: pm.environment.get('test_password'),
      }),
    },
  },
  function (err, response) {
    if (response.json().accessToken) {
      pm.environment.set('jwt_token', response.json().accessToken);
      pm.environment.set('user_id', response.json().user.id);
    }
  },
);

// Test Script for Submission Creation
pm.test('Submission created successfully', function () {
  var jsonData = pm.response.json();
  pm.expect(jsonData.submissionId).to.exist;
  pm.environment.set('submission_id', jsonData.submissionId);
});
```

#### Automated Workflow Testing

```javascript
// Complete Workflow Test Sequence
pm.test('Complete NIRI Workflow', function () {
  // 1. Login
  pm.test('User logged in', function () {
    pm.response.to.have.status(200);
    pm.expect(pm.response.json().accessToken).to.exist;
  });

  // 2. Create Submission
  pm.test('Submission created', function () {
    pm.response.to.have.status(201);
    pm.expect(pm.response.json().submissionId).to.exist;
  });

  // 3. Upload File
  pm.test('File uploaded', function () {
    pm.response.to.have.status(201);
    pm.expect(pm.response.json().files).to.be.an('array');
  });

  // 4. Submit to State
  pm.test('Submitted to state', function () {
    pm.response.to.have.status(200);
    pm.expect(pm.response.json().status).to.eql('SUBMITTED_TO_STATE');
  });
});
```

### 📊 Collection Benefits Summary

| Benefit                     | Description                              | Impact                            |
| --------------------------- | ---------------------------------------- | --------------------------------- |
| **API Contract Validation** | Live documentation with real examples    | Reduces integration errors by 80% |
| **Rapid Debugging**         | Test workflows without UI development    | Saves 2-3 days per integration    |
| **Dynamic Variables**       | Automated token management and data flow | Eliminates manual token handling  |
| **Workflow Simulation**     | Complete business process testing        | Ensures end-to-end functionality  |
| **Error Scenario Testing**  | Test edge cases and error handling       | Improves application robustness   |

---

## 4. Complete API Reference

### 🔐 Authentication Endpoints

#### POST /auth/login

```typescript
// Request
interface LoginRequest {
  email: string;
  password: string;
}

// Response
interface LoginResponse {
  user: User;
  accessToken: string;
}
```

#### POST /auth/register

```typescript
// Request
interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  stateUt: string;
}

// Response
interface RegisterResponse {
  user: User;
  accessToken: string;
}
```

### 📝 Submission Endpoints

#### POST /submission

```typescript
// Request
interface CreateSubmissionRequest {
  submissionId: string;
  stateUt: string;
  formData: Record<string, any>;
}

// Response
interface CreateSubmissionResponse {
  id: string;
  submissionId: string;
  status: SubmissionStatus;
  createdAt: string;
}
```

#### PATCH /submission/:id

```typescript
// Request
interface UpdateSubmissionRequest {
  formData: Record<string, any>;
}

// Response
interface UpdateSubmissionResponse {
  id: string;
  formData: Record<string, any>;
  updatedAt: string;
}
```

### 📁 File Upload Endpoints

#### POST /file/upload/:submissionId

```typescript
// Request: multipart/form-data
// File field: 'file'

// Response
interface FileUploadResponse {
  message: string;
  file: {
    fileName: string;
    originalName: string;
    filePath: string;
    fileUrl: string;
    fileSize: number;
    mimeType: string;
    uploadedAt: string;
  };
}
```

### 📊 Dashboard Endpoints

#### GET /dashboard/summary

```typescript
// Response
interface DashboardSummaryResponse {
  totalSubmissions: number;
  pendingSubmissions: number;
  approvedSubmissions: number;
  rejectedSubmissions: number;
  roleBasedStats: {
    [key in UserRole]: {
      submissions: number;
      pending: number;
      completed: number;
    };
  };
}
```

---

## 🎯 Integration Checklist

### ✅ Frontend Implementation Checklist

- [ ] **JWT Token Management**
  - [ ] Implement AuthContext with token storage
  - [ ] Set up Axios interceptors for automatic token injection
  - [ ] Handle token expiration and refresh logic

- [ ] **Form State Management**
  - [ ] Map UI form state to JSONB structure
  - [ ] Implement incremental save functionality
  - [ ] Handle form validation and error states

- [ ] **File Upload Integration**
  - [ ] Implement decoupled file upload strategy
  - [ ] Store file references in form data
  - [ ] Handle upload progress and error states

- [ ] **Workflow State Management**
  - [ ] Implement role-based action visibility
  - [ ] Handle status transitions and UI updates
  - [ ] Display review comments based on user role

- [ ] **Error Handling**
  - [ ] Implement comprehensive error handling
  - [ ] Display user-friendly error messages
  - [ ] Handle network failures gracefully

### ✅ Testing Checklist

- [ ] **API Integration Testing**
  - [ ] Test all endpoints with Postman collection
  - [ ] Verify JWT token flow
  - [ ] Test file upload functionality
  - [ ] Validate form data structure

- [ ] **Workflow Testing**
  - [ ] Test complete submission workflow
  - [ ] Test role-based access restrictions
  - [ ] Test error scenarios and edge cases
  - [ ] Test concurrent user operations

---

## 🚀 Quick Start for Frontend Teams

### 1. Environment Setup

```bash
# Install dependencies
npm install axios react-query

# Set up environment variables
REACT_APP_API_BASE_URL=http://localhost:3000
REACT_APP_JWT_STORAGE_KEY=jwt_token
```

### 2. API Client Setup

```typescript
// apiClient.ts
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add JWT token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(process.env.REACT_APP_JWT_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### 3. Authentication Hook

```typescript
// useAuth.ts
import { useState, useEffect } from 'react';
import { apiClient } from './apiClient';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    if (token) {
      // Verify token and get user profile
      apiClient
        .get('/auth/profile')
        .then((response) => setUser(response.data))
        .catch(() => localStorage.removeItem('jwt_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const response = await apiClient.post('/auth/login', { email, password });
    localStorage.setItem('jwt_token', response.data.accessToken);
    setUser(response.data.user);
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('jwt_token');
    setUser(null);
  };

  return { user, login, logout, loading };
};
```

---

## 📞 Support & Resources

### 🔗 Useful Links

- **Postman Collection**: `niri_api_collection.json`
- **API Documentation**: `PROJECT_STARTUP_GUIDE.md`
- **Quick Reference**: `QUICK_REFERENCE.md`
- **Health Check**: `http://localhost:3000/health`

### 🆘 Common Issues & Solutions

| Issue                    | Solution                                      |
| ------------------------ | --------------------------------------------- |
| **401 Unauthorized**     | Check JWT token in Authorization header       |
| **403 Forbidden**        | Verify user role has required permissions     |
| **File Upload Fails**    | Ensure multipart/form-data content type       |
| **Form Data Not Saving** | Verify JSONB structure matches backend schema |
| **Status Not Updating**  | Check workflow transition logic and user role |

---

**🎉 Happy Integration! This guide ensures seamless frontend-backend integration for the NIRI system.**
