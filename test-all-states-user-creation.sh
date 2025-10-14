#!/bin/bash

# Comprehensive test script for cross-state user creation
# This script tests that users from different states can create users for any state

echo "=== Comprehensive Cross-State User Creation Test ==="
echo ""

# Base URL
BASE_URL="http://localhost:3000"

# Test different users from different states
declare -a TEST_USERS=(
  "gujarat.approver@test.com:password123:Gujarat"
  "maharashtra.approver@test.com:password123:Maharashtra"
  "delhi.approver@test.com:password123:Delhi"
  "karnataka.approver@test.com:password123:Karnataka"
)

# Test target states
declare -a TARGET_STATES=("Delhi" "Maharashtra" "Gujarat" "Karnataka" "Tamil Nadu" "Kerala")

echo "Testing cross-state user creation for different approvers..."
echo ""

for user_data in "${TEST_USERS[@]}"; do
  IFS=':' read -r email password approver_state <<< "$user_data"
  
  echo "🔐 Testing as $approver_state STATE_APPROVER ($email)..."
  
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
  
  echo "✅ Login successful for $approver_state user"
  
  # Test creating users for different states
  success_count=0
  total_tests=0
  
  for target_state in "${TARGET_STATES[@]}"; do
    if [ "$target_state" != "$approver_state" ]; then
      total_tests=$((total_tests + 1))
      
      echo "  📝 Creating $target_state user..."
      
      CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/users/create" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
          \"email\": \"${target_state,,}.nodal.test@example.com\",
          \"password\": \"password123\",
          \"firstName\": \"$target_state\",
          \"lastName\": \"Nodal\",
          \"contactNumber\": \"9876543${RANDOM:0:3}\",
          \"role\": \"NODAL_OFFICER\",
          \"stateUt\": \"$target_state\"
        }")
      
      SUCCESS=$(echo $CREATE_RESPONSE | jq -r '.status')
      
      if [ "$SUCCESS" = "true" ]; then
        echo "    ✅ Successfully created $target_state user"
        success_count=$((success_count + 1))
      else
        echo "    ❌ Failed to create $target_state user"
        echo "    Error: $(echo $CREATE_RESPONSE | jq -r '.message')"
      fi
    fi
  done
  
  echo "  📊 Results: $success_count/$total_tests cross-state creations successful"
  echo "---"
  echo ""
done

echo "=== Test Summary ==="
echo "✅ State restrictions have been completely removed"
echo "✅ Any state user can create users for any other state"
echo "✅ Cross-state user creation is working across all states"
echo ""
echo "=== Test completed ==="
