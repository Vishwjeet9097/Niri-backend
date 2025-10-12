#!/bin/bash

# Simple API Test Script
echo "🧪 Testing NIRI API Endpoints"

BASE_URL="http://localhost:3000"

# Test 1: Health Check
echo "1. Health Check"
curl -s "$BASE_URL/health" | jq .

# Test 2: Register User
echo "2. Register Test User"
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "debug.test@maharashtra.gov.in",
    "password": "password123",
    "firstName": "Debug",
    "lastName": "Test",
    "role": "NODAL_OFFICER",
    "stateUt": "Maharashtra"
  }')

echo "$REGISTER_RESPONSE" | jq .
TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.accessToken')

# Test 3: Create Submission
echo "3. Create Submission"
SUBMISSION_RESPONSE=$(curl -s -X POST "$BASE_URL/submission" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "submissionId": "SUB-DEBUG-001",
    "formData": {
      "qualityIndex": 8.0,
      "socialImpact": 7.5
    }
  }')

echo "$SUBMISSION_RESPONSE" | jq .
SUBMISSION_ID=$(echo "$SUBMISSION_RESPONSE" | jq -r '.id')

# Test 4: Submit to State
echo "4. Submit to State"
curl -s -X POST "$BASE_URL/submission/submit-to-state/$SUBMISSION_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Test 5: Register State Approver
echo "5. Register State Approver"
STATE_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "debug.state@maharashtra.gov.in",
    "password": "password123",
    "firstName": "Debug",
    "lastName": "State",
    "role": "STATE_APPROVER",
    "stateUt": "Maharashtra"
  }')

echo "$STATE_RESPONSE" | jq .
STATE_TOKEN=$(echo "$STATE_RESPONSE" | jq -r '.accessToken')

# Test 6: Forward to MoSPI
echo "6. Forward to MoSPI"
curl -s -X POST "$BASE_URL/submission/forward-to-mospi/$SUBMISSION_ID" \
  -H "Authorization: Bearer $STATE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment": "Test comment"}' | jq .

echo "✅ Test completed!"
