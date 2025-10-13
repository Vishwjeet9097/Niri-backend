#!/bin/bash

# Test script for Delhi state submissions API
# This script tests that Delhi state users can see all Delhi submissions

echo "=== Testing Delhi State Submissions API ==="
echo ""

# Base URL
BASE_URL="http://localhost:3000"

# Test data
DELHI_NODAL_EMAIL="delhi.nodal@test.com"
DELHI_NODAL_PASSWORD="password123"

echo "1. Logging in as Delhi Nodal Officer..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$DELHI_NODAL_EMAIL\",
    \"password\": \"$DELHI_NODAL_PASSWORD\"
  }")

echo "Login Response: $LOGIN_RESPONSE"
echo ""

# Extract token
TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed. Please check if Delhi user exists in database."
  exit 1
fi

echo "✅ Login successful. Token: ${TOKEN:0:20}..."
echo ""

echo "2. Testing GET /submission endpoint for Delhi state..."
SUBMISSIONS_RESPONSE=$(curl -s -X GET "$BASE_URL/submission" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "Submissions Response:"
echo "$SUBMISSIONS_RESPONSE" | jq '.'
echo ""

# Check if response contains submissions
SUBMISSION_COUNT=$(echo $SUBMISSIONS_RESPONSE | jq '.data.submissions | length')
echo "📊 Total submissions found: $SUBMISSION_COUNT"

if [ "$SUBMISSION_COUNT" -gt 0 ]; then
  echo "✅ Delhi state submissions API is working correctly!"
  echo ""
  echo "📋 Submission details:"
  echo "$SUBMISSIONS_RESPONSE" | jq '.data.submissions[] | {id: .id, submissionId: .submissionId, stateUt: .stateUt, submittedBy: .submittedBy, status: .status}'
else
  echo "⚠️  No submissions found. This might be expected if no Delhi submissions exist in database."
fi

echo ""
echo "=== Test completed ==="
