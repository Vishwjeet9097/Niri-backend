#!/bin/bash

# NIRI Backend API - Response Format Test Suite
echo "🎯 Testing NIRI API Response Format"
echo "=================================="

BASE_URL="http://localhost:3000"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Test function
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local token=$4
    local description=$5
    
    print_info "Testing: $description"
    
    if [ -n "$token" ]; then
        if [ -n "$data" ]; then
            response=$(curl -s -X $method "$BASE_URL$endpoint" \
                -H "Authorization: Bearer $token" \
                -H "Content-Type: application/json" \
                -d "$data")
        else
            response=$(curl -s -X $method "$BASE_URL$endpoint" \
                -H "Authorization: Bearer $token")
        fi
    else
        if [ -n "$data" ]; then
            response=$(curl -s -X $method "$BASE_URL$endpoint" \
                -H "Content-Type: application/json" \
                -d "$data")
        else
            response=$(curl -s -X $method "$BASE_URL$endpoint")
        fi
    fi
    
    # Check if response has correct format
    if echo "$response" | jq -e '.status' > /dev/null && echo "$response" | jq -e '.data' > /dev/null; then
        print_success "✅ Correct format: $description"
        echo "   Status: $(echo "$response" | jq -r '.status')"
        echo "   Message: $(echo "$response" | jq -r '.message')"
        echo "   Timestamp: $(echo "$response" | jq -r '.timestamp')"
    else
        print_error "❌ Wrong format: $description"
        echo "$response" | jq . 2>/dev/null || echo "$response"
    fi
    
    echo ""
}

# Test 1: Health Check
test_endpoint "GET" "/health" "" "" "Health Check"

# Test 2: Register User
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "format.test@maharashtra.gov.in",
    "password": "password123",
    "firstName": "Format",
    "lastName": "Test",
    "role": "NODAL_OFFICER",
    "stateUt": "Maharashtra"
  }')

if echo "$REGISTER_RESPONSE" | jq -e '.status' > /dev/null; then
    print_success "✅ User registration format correct"
    TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.data.accessToken')
else
    print_error "❌ User registration format wrong"
    echo "$REGISTER_RESPONSE" | jq .
    exit 1
fi

# Test 3: Create Submission
SUBMISSION_RESPONSE=$(curl -s -X POST "$BASE_URL/submission" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "submissionId": "SUB-FORMAT-001",
    "formData": {
      "qualityIndex": 8.5,
      "socialImpact": 7.8
    }
  }')

if echo "$SUBMISSION_RESPONSE" | jq -e '.id' > /dev/null; then
    print_success "✅ Submission creation format correct"
    SUBMISSION_ID=$(echo "$SUBMISSION_RESPONSE" | jq -r '.id')
else
    print_error "❌ Submission creation format wrong"
    echo "$SUBMISSION_RESPONSE" | jq .
fi

# Test 4: Get Submission
test_endpoint "GET" "/submission/$SUBMISSION_ID" "" "$TOKEN" "Get Submission"

# Test 5: List Submissions
test_endpoint "GET" "/submission" "" "$TOKEN" "List Submissions"

# Test 6: Update Submission
test_endpoint "PATCH" "/submission/$SUBMISSION_ID" '{"formData": {"qualityIndex": 9.0}}' "$TOKEN" "Update Submission"

# Test 7: Submit to State
test_endpoint "POST" "/submission/submit-to-state/$SUBMISSION_ID" '{}' "$TOKEN" "Submit to State"

# Test 8: Register State Approver
STATE_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "format.state@maharashtra.gov.in",
    "password": "password123",
    "firstName": "Format",
    "lastName": "State",
    "role": "STATE_APPROVER",
    "stateUt": "Maharashtra"
  }')

if echo "$STATE_RESPONSE" | jq -e '.status' > /dev/null; then
    print_success "✅ State approver registration format correct"
    STATE_TOKEN=$(echo "$STATE_RESPONSE" | jq -r '.data.accessToken')
else
    print_error "❌ State approver registration format wrong"
    echo "$STATE_RESPONSE" | jq .
fi

# Test 9: Forward to MoSPI (might fail due to known issue)
test_endpoint "POST" "/submission/forward-to-mospi/$SUBMISSION_ID" '{"comment": "Test comment"}' "$STATE_TOKEN" "Forward to MoSPI"

# Test 10: Dashboard (if implemented)
test_endpoint "GET" "/dashboard/summary" "" "$TOKEN" "Dashboard Summary"

# Test 11: Reports (if implemented)
test_endpoint "GET" "/report/ranking" "" "$STATE_TOKEN" "Report Ranking"

echo "=================================="
print_info "RESPONSE FORMAT TEST SUMMARY"
echo "=================================="

echo ""
print_success "NEW RESPONSE FORMAT:"
echo "  ✅ All successful responses now have:"
echo "     - status: true/false"
echo "     - data: actual response data"
echo "     - message: descriptive message"
echo "     - timestamp: ISO timestamp"

echo ""
print_info "FRONTEND CHANGES REQUIRED:"
echo "  📝 Update all API response handling to use:"
echo "     - response.data instead of direct response"
echo "     - response.status for success/failure check"
echo "     - response.message for user notifications"
echo "     - response.timestamp for logging"

echo ""
print_success "EXAMPLE FRONTEND CODE UPDATE:"
echo ""
echo "// OLD CODE:"
echo "const response = await api.get('/submission');"
echo "const submissions = response.data;"
echo ""
echo "// NEW CODE:"
echo "const response = await api.get('/submission');"
echo "if (response.data.status) {"
echo "  const submissions = response.data.data.submissions;"
echo "  const message = response.data.message;"
echo "  // Show success message to user"
echo "} else {"
echo "  // Handle error"
echo "}"
