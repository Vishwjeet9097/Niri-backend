# NIRI Backend API - Status Codes Quick Reference Prompt

## 🎯 **Complete Status Codes Used in NIRI Backend API**

### ✅ **Success Status Codes (2xx)**

- **200 OK** - Request successful (GET, PATCH, PUT operations)
- **201 Created** - Resource created successfully (POST operations)
- **202 Accepted** - Request accepted for processing (Async operations)

### ❌ **Client Error Status Codes (4xx)**

- **400 Bad Request** - Invalid request data (Validation errors, malformed JSON)
- **401 Unauthorized** - Authentication required (Missing/invalid JWT token)
- **403 Forbidden** - Access denied (Insufficient permissions, role restrictions)
- **404 Not Found** - Resource not found (Invalid ID, non-existent resource)
- **409 Conflict** - Resource conflict (Duplicate data, business rule violations)
- **422 Unprocessable Entity** - Validation failed (Field validation errors)
- **429 Too Many Requests** - Rate limit exceeded (API rate limiting)

### 🔥 **Server Error Status Codes (5xx)**

- **500 Internal Server Error** - Server error (Database errors, unexpected exceptions)
- **502 Bad Gateway** - Gateway error (External service failures)
- **503 Service Unavailable** - Service down (Maintenance, overload)
- **504 Gateway Timeout** - Timeout error (External service timeouts)

## 📊 **Response Format Used**

```json
{
  "status": true/false,
  "data": { /* actual data */ },
  "message": "Descriptive message",
  "timestamp": "2025-10-10T19:37:11.495Z"
}
```

## 🔍 **Status Code Meanings**

| Code    | Meaning                                  | When Used                                   |
| ------- | ---------------------------------------- | ------------------------------------------- |
| **200** | OK - Request successful                  | GET, PATCH, PUT operations                  |
| **201** | Created - Resource created               | POST operations (new resources)             |
| **202** | Accepted - Request accepted              | Async operations, workflow transitions      |
| **400** | Bad Request - Invalid data               | Validation errors, malformed JSON           |
| **401** | Unauthorized - Auth required             | Missing/invalid JWT token                   |
| **403** | Forbidden - Access denied                | Role restrictions, insufficient permissions |
| **404** | Not Found - Resource missing             | Invalid ID, non-existent resource           |
| **409** | Conflict - Resource conflict             | Duplicate data, business rule violations    |
| **422** | Unprocessable Entity - Validation failed | Field validation errors                     |
| **429** | Too Many Requests - Rate limited         | API rate limiting                           |
| **500** | Internal Server Error - Server error     | Database errors, unexpected exceptions      |
| **502** | Bad Gateway - Gateway error              | External service failures                   |
| **503** | Service Unavailable - Service down       | Maintenance, overload                       |
| **504** | Gateway Timeout - Timeout error          | External service timeouts                   |

## 🚀 **Frontend Integration Changes**

### **OLD CODE:**

```javascript
const response = await api.get('/submission');
const submissions = response.data;
```

### **NEW CODE:**

```javascript
const response = await api.get('/submission');
if (response.data.status) {
  const submissions = response.data.data.submissions;
  const message = response.data.message;
} else {
  // Handle error
}
```

## 📋 **Key Changes for Frontend:**

1. **Data Access**: Use `response.data.data` instead of `response.data`
2. **Status Check**: Check `response.data.status` for success/failure
3. **Error Handling**: Handle both API-level and network errors
4. **User Messages**: Use `response.data.message` for notifications
5. **TypeScript**: Update interfaces to match new response structure

## 🎯 **Error Handling Pattern:**

```javascript
// Handle different status codes
switch (status) {
  case 200:
  case 201:
    // Success - process response.data.data
    break;
  case 400:
    // Bad Request - show validation errors
    break;
  case 401:
    // Unauthorized - redirect to login
    break;
  case 403:
    // Forbidden - show access denied
    break;
  case 404:
    // Not Found - show not found message
    break;
  case 500:
    // Server Error - show generic error
    break;
}
```

## 📚 **Complete Documentation Files:**

1. **API_STATUS_CODES_GUIDE.md** - Complete status code reference
2. **FRONTEND_INTEGRATION_GUIDE_UPDATED.md** - React/Next.js integration
3. **PROJECT_COMPLETE_SUMMARY.md** - Project overview
4. **niri_complete_api_collection.json** - Postman collection

---

**Ready for Frontend Integration!** 🚀

All APIs now return consistent `{status, data, message, timestamp}` format with proper HTTP status codes.
