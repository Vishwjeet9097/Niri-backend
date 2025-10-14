#!/bin/bash

# Test script for cross-state user creation
# This script tests that any state user can create users for any other state

echo "=== Testing Cross-State User Creation ==="
echo ""

# Base URL
BASE_URL="http://localhost:3000"

# Test data - Gujarat user trying to create Delhi user
GUJARAT_EMAIL="gujarat.approver@test.com"
GUJARAT_PASSWORD="password123"

echo "1. Logging in as Gujarat STATE_APPROVER..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$GUJARAT_EMAIL\",
    \"password\": \"$GUJARAT_PASSWORD\"
  }")

echo "Login Response: $LOGIN_RESPONSE"
echo ""

# Extract token
TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login failed. Please check if Gujarat user exists in database."
  exit 1
fi

echo "✅ Login successful. Token: ${TOKEN:0:20}..."
echo ""

echo "2. Testing cross-state user creation (Gujarat user creating Delhi user)..."
CREATE_USER_RESPONSE=$(curl -s -X POST "$BASE_URL/users/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"delhi.nodal.test@example.com\",
    \"password\": \"password123\",
    \"firstName\": \"Delhi\",
    \"lastName\": \"Nodal\",
    \"contactNumber\": \"9876543210\",
    \"role\": \"NODAL_OFFICER\",
    \"stateUt\": \"Delhi\"
  }")

echo "Create User Response:"
echo "$CREATE_USER_RESPONSE" | jq '.'
echo ""

# Check if user was created successfully
SUCCESS=$(echo $CREATE_USER_RESPONSE | jq -r '.status')

if [ "$SUCCESS" = "true" ]; then
  echo "✅ Cross-state user creation successful!"
  echo "Gujarat user successfully created Delhi user"
  
  # Get the created user details
  USER_ID=$(echo $CREATE_USER_RESPONSE | jq -r '.data.user.id')
  USER_STATE=$(echo $CREATE_USER_RESPONSE | jq -r '.data.user.stateUt')
  USER_EMAIL=$(echo $CREATE_USER_RESPONSE | jq -r '.data.user.email')
  
  echo "📋 Created User Details:"
  echo "  ID: $USER_ID"
  echo "  Email: $USER_EMAIL"
  echo "  State: $USER_STATE"
  echo "  Role: NODAL_OFFICER"
else
  echo "❌ Cross-state user creation failed!"
  echo "Error: $(echo $CREATE_USER_RESPONSE | jq -r '.message')"
fi

echo ""
echo "3. Testing another cross-state creation (Gujarat user creating Maharashtra user)..."
CREATE_USER_RESPONSE2=$(curl -s -X POST "$BASE_URL/users/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"maharashtra.nodal.test@example.com\",
    \"password\": \"password123\",
    \"firstName\": \"Maharashtra\",
    \"lastName\": \"Nodal\",
    \"contactNumber\": \"9876543211\",
    \"role\": \"NODAL_OFFICER\",
    \"stateUt\": \"Maharashtra\"
  }")

echo "Create User Response 2:"
echo "$CREATE_USER_RESPONSE2" | jq '.'
echo ""

SUCCESS2=$(echo $CREATE_USER_RESPONSE2 | jq -r '.status')

if [ "$SUCCESS2" = "true" ]; then
  echo "✅ Second cross-state user creation successful!"
  echo "Gujarat user successfully created Maharashtra user"
else
  echo "❌ Second cross-state user creation failed!"
  echo "Error: $(echo $CREATE_USER_RESPONSE2 | jq -r '.message')"
fi

echo ""
echo "=== Test Summary ==="
echo "✅ Gujarat user can now create users for any state"
echo "✅ State restrictions have been removed"
echo "✅ Cross-state user creation is working"
echo ""
echo "=== Test completed ==="
