#!/bin/bash

# Debug script to check state issue
# This script will test user creation and check what state is actually being saved

echo "=== Debug State Issue ==="
echo ""

# Base URL
BASE_URL="http://localhost:3000"

# Test data
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

echo "2. Creating user with Bihar state in payload..."
CREATE_USER_RESPONSE=$(curl -s -X POST "$BASE_URL/users/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"bihar.nodal.test@example.com\",
    \"password\": \"password123\",
    \"firstName\": \"Bihar\",
    \"lastName\": \"Nodal\",
    \"contactNumber\": \"9876543210\",
    \"role\": \"NODAL_OFFICER\",
    \"stateUt\": \"Bihar\"
  }")

echo "Create User Response:"
echo "$CREATE_USER_RESPONSE" | jq '.'
echo ""

# Check what state was actually saved
if [ "$(echo $CREATE_USER_RESPONSE | jq -r '.status')" = "true" ]; then
  CREATED_USER_ID=$(echo $CREATE_USER_RESPONSE | jq -r '.data.user.id')
  CREATED_USER_STATE=$(echo $CREATE_USER_RESPONSE | jq -r '.data.user.stateUt')
  
  echo "📋 Created User Details:"
  echo "  ID: $CREATED_USER_ID"
  echo "  State in Response: $CREATED_USER_STATE"
  echo "  Expected State: Bihar"
  
  if [ "$CREATED_USER_STATE" = "Bihar" ]; then
    echo "✅ State correctly saved as Bihar"
  else
    echo "❌ State mismatch! Expected Bihar but got $CREATED_USER_STATE"
  fi
  
  echo ""
  echo "3. Fetching user details to double-check..."
  USER_DETAILS=$(curl -s -X GET "$BASE_URL/users/$CREATED_USER_ID" \
    -H "Authorization: Bearer $TOKEN")
  
  echo "User Details from GET request:"
  echo "$USER_DETAILS" | jq '.'
  
  FETCHED_STATE=$(echo $USER_DETAILS | jq -r '.data.stateUt')
  echo ""
  echo "State from GET request: $FETCHED_STATE"
  
  if [ "$FETCHED_STATE" = "Bihar" ]; then
    echo "✅ State correctly saved in database as Bihar"
  else
    echo "❌ State mismatch in database! Expected Bihar but got $FETCHED_STATE"
  fi
else
  echo "❌ User creation failed!"
  echo "Error: $(echo $CREATE_USER_RESPONSE | jq -r '.message')"
fi

echo ""
echo "=== Debug completed ==="
