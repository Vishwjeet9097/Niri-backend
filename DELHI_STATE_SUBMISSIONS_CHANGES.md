# Delhi State Submissions API Changes

## Overview

यह document Delhi state के लिए submission API में किए गए changes को explain करता है।

## Requirement

- जब कोई user login हो और उसकी state Delhi हो
- तो उसे सभी Delhi state के users के submissions मिलें
- सभी roles के लिए (NODAL_OFFICER, STATE_APPROVER, etc.)

## Changes Made

### 1. Submission Service (`src/modules/submission/submission.service.ts`)

**File:** `src/modules/submission/submission.service.ts`  
**Method:** `findAll()`

**Before:**

```typescript
if (userRole === UserRole.NODAL_OFFICER) {
  query.andWhere("submission.stateUt = :stateUt", { stateUt: userStateUt });
  query.andWhere("submission.submittedBy = :userId", { userId }); // Only own submissions
}
```

**After:**

```typescript
if (userRole === UserRole.NODAL_OFFICER) {
  // Special case for Delhi state - show all Delhi submissions regardless of who submitted
  if (userStateUt === "Delhi") {
    query.andWhere("submission.stateUt = :stateUt", { stateUt: userStateUt });
    // Remove the submittedBy filter for Delhi state to show all Delhi submissions
  } else {
    query.andWhere("submission.stateUt = :stateUt", { stateUt: userStateUt });
    query.andWhere("submission.submittedBy = :userId", { userId }); // Only own submissions
  }
}
```

## How It Works

### For Delhi State Users:

1. **NODAL_OFFICER** role के Delhi users को सभी Delhi submissions दिखेंगे
2. **STATE_APPROVER** role के Delhi users को पहले से ही सभी Delhi submissions दिखते थे (unchanged)
3. **MoSPI roles** को पहले से ही सभी submissions दिखते थे (unchanged)

### For Non-Delhi State Users:

- सभी non-Delhi users को केवल अपने own submissions दिखेंगे (unchanged behavior)

## Testing

### Test Scripts Created:

1. `test-delhi-submissions.sh` - Basic Delhi submissions test
2. `test-delhi-comprehensive.sh` - Comprehensive test for different roles and states

### How to Run Tests:

```bash
# Basic test
./test-delhi-submissions.sh

# Comprehensive test
./test-delhi-comprehensive.sh
```

## API Endpoints Affected

- `GET /submission` - Main submissions listing endpoint
- All existing query parameters work as before
- No breaking changes to existing functionality

## Database Impact

- कोई database schema changes नहीं
- कोई data migration नहीं required
- Existing data unchanged

## Security Considerations

- Delhi state users केवल अपने state के submissions देख सकते हैं
- Other states के submissions नहीं देख सकते
- Role-based access control maintained

## Backward Compatibility

- ✅ Existing functionality unchanged
- ✅ Non-Delhi states work exactly as before
- ✅ MoSPI roles work exactly as before
- ✅ All existing API contracts maintained

## Example Usage

### Delhi NODAL_OFFICER Login:

```bash
curl -X GET "http://localhost:3000/submission" \
  -H "Authorization: Bearer <delhi_nodal_token>"
```

**Response:** सभी Delhi state के submissions (सभी users के)

### Maharashtra NODAL_OFFICER Login:

```bash
curl -X GET "http://localhost:3000/submission" \
  -H "Authorization: Bearer <maharashtra_nodal_token>"
```

**Response:** केवल अपने own submissions

## Conclusion

यह change specifically Delhi state के लिए है और अन्य states के behavior को affect नहीं करता। Delhi state के users अब सभी Delhi submissions देख सकते हैं, जो requirement के अनुसार है।
