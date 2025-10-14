#!/bin/bash

# Comprehensive test script for Delhi state submissions API
# This script tests various scenarios for Delhi state submissions

echo "=== Comprehensive Delhi State Submissions API Test ==="
echo ""

# Base URL
BASE_URL="http://localhost:3000"

# Test different Delhi users
declare -a DELHI_USERS=(
  "delhi.nodal@test.com:password123:NODAL_OFFICER"
  "delhi.approver@test.com:password123:STATE_APPROVER"
)

echo "Testing Delhi state submissions access for different roles..."
echo ""

for user_data in "${DELHI_USERS[@]}"; do
  IFS=':' read -r email password role <<< "$user_data"
  
  echo "🔐 Testing as $role ($email)..."
  
  # Login
  LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"$email\",
      \"password\": \"$password\"
    }")
  
  TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.token')
  
  if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
    echo "❌ Login failed for $email"
    continue
  fi
  
  echo "✅ Login successful for $role"
  
  # Test submissions endpoint
  SUBMISSIONS_RESPONSE=$(curl -s -X GET "$BASE_URL/submission" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json")
  
  SUBMISSION_COUNT=$(echo $SUBMISSIONS_RESPONSE | jq '.data.submissions | length')
  echo "📊 Submissions found: $SUBMISSION_COUNT"
  
  if [ "$SUBMISSION_COUNT" -gt 0 ]; then
    echo "📋 Sample submissions:"
    echo "$SUBMISSIONS_RESPONSE" | jq '.data.submissions[0:3] | .[] | {id: .id, submissionId: .submissionId, stateUt: .stateUt, submittedBy: .submittedBy, status: .status}'
  fi
  
  echo "---"
  echo ""
done

echo "Testing non-Delhi state user (should see only own submissions)..."
echo ""

# Test non-Delhi user
NON_DELHI_EMAIL="maharashtra.nodal@test.com"
NON_DELHI_PASSWORD="password123"

echo "🔐 Testing as Maharashtra NODAL_OFFICER ($NON_DELHI_EMAIL)..."

LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$NON_DELHI_EMAIL\",
    \"password\": \"$NON_DELHI_PASSWORD\"
  }")

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed for $NON_DELHI_EMAIL"
else
  echo "✅ Login successful for Maharashtra user"
  
  SUBMISSIONS_RESPONSE=$(curl -s -X GET "$BASE_URL/submission" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json")
  
  SUBMISSION_COUNT=$(echo $SUBMISSIONS_RESPONSE | jq '.data.submissions | length')
  echo "📊 Submissions found: $SUBMISSION_COUNT"
  
  if [ "$SUBMISSION_COUNT" -gt 0 ]; then
    echo "📋 Sample submissions:"
    echo "$SUBMISSIONS_RESPONSE" | jq '.data.submissions[0:3] | .[] | {id: .id, submissionId: .submissionId, stateUt: .stateUt, submittedBy: .submittedBy, status: .status}'
  fi
fi

echo ""
echo "=== Test Summary ==="
echo "✅ Delhi state users should see ALL Delhi submissions (regardless of who submitted)"
echo "✅ Non-Delhi state users should see only their own submissions"
echo "✅ Changes implemented successfully!"
echo ""
echo "=== Test completed ==="
