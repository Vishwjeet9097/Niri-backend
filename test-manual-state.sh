#!/bin/bash

# Manual test for state issue
echo "=== Manual State Test ==="
echo ""

# Wait for server to start
echo "Waiting for server to start..."
sleep 10

# Base URL
BASE_URL="http://localhost:3000"

echo "1. Testing server health..."
HEALTH_RESPONSE=$(curl -s -X GET "$BASE_URL/health")
echo "Health Response: $HEALTH_RESPONSE"
echo ""

echo "2. Testing with a simple user creation..."
# First, let's try to register a user directly
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"test.gujarat@example.com\",
    \"password\": \"password123\",
    \"firstName\": \"Test\",
    \"lastName\": \"Gujarat\",
    \"role\": \"STATE_APPROVER\",
    \"stateUt\": \"Gujarat\"
  }")

echo "Register Response:"
echo "$REGISTER_RESPONSE" | jq '.'
echo ""

# Extract token
TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.data.accessToken')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Registration failed. Trying with existing user..."
  
  # Try with a known user
  LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"admin@test.com\",
      \"password\": \"password123\"
    }")
  
  echo "Login Response: $LOGIN_RESPONSE"
  TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.token')
fi

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Both registration and login failed. Exiting."
  exit 1
fi

echo "✅ Got token: ${TOKEN:0:20}..."
echo ""

echo "3. Creating user with Bihar state..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/users/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"bihar.test@example.com\",
    \"password\": \"password123\",
    \"firstName\": \"Bihar\",
    \"lastName\": \"Test\",
    \"contactNumber\": \"9876543210\",
    \"role\": \"NODAL_OFFICER\",
    \"stateUt\": \"Bihar\"
  }")

echo "Create User Response:"
echo "$CREATE_RESPONSE" | jq '.'
echo ""

# Check what state was actually saved
if [ "$(echo $CREATE_RESPONSE | jq -r '.status')" = "true" ]; then
  CREATED_STATE=$(echo $CREATE_RESPONSE | jq -r '.data.user.stateUt')
  echo "📋 Created User State: $CREATED_STATE"
  echo "Expected State: Bihar"
  
  if [ "$CREATED_STATE" = "Bihar" ]; then
    echo "✅ State correctly saved as Bihar"
  else
    echo "❌ State mismatch! Expected Bihar but got $CREATED_STATE"
  fi
else
  echo "❌ User creation failed!"
  echo "Error: $(echo $CREATE_RESPONSE | jq -r '.message')"
fi

echo ""
echo "=== Test completed ==="
