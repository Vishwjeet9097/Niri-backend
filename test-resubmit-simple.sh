#!/bin/bash

echo "🧪 Testing Resubmit Endpoint Changes"
echo "====================================="

# Test 1: Login and get token
echo "📝 Step 1: Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "nodal@test.com", "password": "password123"}')

echo "Login Response: $LOGIN_RESPONSE"

# Extract token (assuming response has token field)
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ Failed to get token"
    exit 1
fi

echo "✅ Token obtained: ${TOKEN:0:20}..."

# Test 2: Test resubmit with different statuses
echo ""
echo "📝 Step 2: Testing resubmit with different statuses..."

# Test with a sample submission ID (you may need to change this)
SUBMISSION_ID="9e331272-e14d-431f-a990-92fce7df27fc"

echo "Testing resubmit for submission: $SUBMISSION_ID"

RESUBMIT_RESPONSE=$(curl -s -X POST "http://localhost:3000/submission/resubmit/$SUBMISSION_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"comment": "Testing resubmit with updated permissions"}')

echo "Resubmit Response: $RESUBMIT_RESPONSE"

# Check if the response contains the old error message
if echo "$RESUBMIT_RESPONSE" | grep -q "Can only resubmit rejected submissions"; then
    echo "❌ OLD ERROR: Still getting 'Can only resubmit rejected submissions'"
    echo "   This means the changes didn't work properly"
else
    echo "✅ SUCCESS: No longer getting the old error message"
    echo "   The resubmit endpoint now accepts more statuses"
fi

echo ""
echo "🎉 Test completed!"
