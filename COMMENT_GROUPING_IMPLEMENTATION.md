# Comment Grouping Implementation Documentation

## Overview

This document outlines the implementation of the comment grouping functionality in the NIRI Backend API. The feature allows comments to be organized by sections for better readability and structure in the frontend.

## Implementation Details

### 1. Service Layer - `submission.service.ts`

A new method `groupCommentsBySection` has been added to the `SubmissionService` class. This method:

- Takes a flat array of `ReviewComment` objects as input
- Organizes them by section number (e.g., "1.1", "1.2", etc.) based on the `sectionId` or `type` property
- Returns a structured object where keys are section numbers and values are arrays of comments for that section

```typescript
public groupCommentsBySection(comments: ReviewComment[]): Record<string, ReviewComment[]> {
  // Implementation details (see code)
}
```

Section mapping is handled with two maps:
- `sectionMap` - For direct mapping of section IDs to section numbers
- `prefixMap` - For handling nested section paths (e.g., "infrastructureMetrics.subitem")

### 2. Controller Layer - `submission.controller.ts`

The `findOne` method in `SubmissionController` has been updated to:

- Fetch the submission as before
- Add a new property `commentsBySection` to the response
- Keep the original `reviewComments` array intact for backward compatibility

```typescript
async findOne(@Param("id") id: string, @Request() req) {
  const submission = await this.submissionService.findOne(id, req.user.role, req.user.stateUt);
  
  // Group comments by section for the response
  if (submission.reviewComments && Array.isArray(submission.reviewComments) && submission.reviewComments.length > 0) {
    const originalComments = [...submission.reviewComments];
    const groupedComments = this.submissionService.groupCommentsBySection(originalComments);
    submission['commentsBySection'] = groupedComments;
  }
  
  return submission;
}
```

### 3. Testing Endpoint

A testing endpoint has been added to help verify the comment grouping functionality:

```typescript
@Get("test/comments/:id")
@UseGuards(RolesGuard)
@Roles(
  UserRole.NODAL_OFFICER,
  UserRole.STATE_APPROVER,
  UserRole.MOSPI_REVIEWER,
  UserRole.MOSPI_APPROVER
)
async testCommentGrouping(@Param("id") id: string, @Request() req) {
  // Implementation details (see code)
}
```

## Testing

A test file `test-comment-grouping.http` has been created to test the comment grouping functionality. It includes:

- A request to the test endpoint that returns only the comments and their grouped version
- A request to the regular submission endpoint to verify the modified response format

## Usage in Frontend

Frontend applications should now be updated to use the new `commentsBySection` property from the API responses. This will allow:

- More organized display of comments by section
- Better user experience when reviewing comments
- Easier filtering and navigation of comments

Example of accessing grouped comments in frontend code:

```typescript
// Angular/TypeScript example
this.submissionService.getSubmission(id).subscribe(submission => {
  // Access all comments (backward compatible)
  const allComments = submission.reviewComments;
  
  // Access comments by section
  const commentsBySection = submission.commentsBySection;
  
  // Display comments for a specific section
  const section1_1Comments = commentsBySection['1.1'] || [];
});
```

## Response Format

The updated API response will include:

```json
{
  "id": "submission-id",
  "status": "SUBMITTED_TO_STATE",
  "reviewComments": [
    // Original flat array of comments (unchanged)
  ],
  "commentsBySection": {
    "1.1": [
      // Comments for section 1.1
    ],
    "1.2": [
      // Comments for section 1.2
    ],
    // Additional sections
  },
  // Other submission properties
}
```

## Conclusion

This implementation provides a clean, non-breaking enhancement to the API. It maintains backward compatibility by preserving the original `reviewComments` array while adding the new structured format in `commentsBySection`.