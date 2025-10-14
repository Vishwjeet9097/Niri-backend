#!/bin/bash

# NIRI API Error Handling Test Script
# यह script different error scenarios test करने के लिए है

echo "🧪 NIRI API Error Handling Test Script"
echo "======================================"

BASE_URL="http://localhost:3000"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo ""
    echo -e "${YELLOW}Testing: $description${NC}"
    echo "Endpoint: $method $endpoint"
    
    if [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    else
        response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint")
    fi
    
    # Split response and status code
    http_code=$(echo "$response" | tail -n1)
    response_body=$(echo "$response" | head -n -1)
    
    echo "Status Code: $http_code"
    echo "Response:"
    echo "$response_body" | jq . 2>/dev/null || echo "$response_body"
    
    if [ "$http_code" -ge 400 ]; then
        echo -e "${GREEN}✅ Error properly handled${NC}"
    else
        echo -e "${RED}❌ Expected error but got success${NC}"
    fi
    
    echo "----------------------------------------"
}

# Check if server is running
echo "🔍 Checking if server is running..."
if ! curl -s "$BASE_URL/health" > /dev/null; then
    echo -e "${RED}❌ Server is not running. Please start the server first.${NC}"
    echo "Run: npm run start:dev"
    exit 1
fi

echo -e "${GREEN}✅ Server is running${NC}"

# Test 1: Health Check
test_endpoint "GET" "/health" "" "Health Check"

# Test 2: Invalid Login Credentials
test_endpoint "POST" "/auth/login" '{"email":"invalid@example.com","password":"wrong"}' "Invalid Login Credentials"

# Test 3: Missing Login Data
test_endpoint "POST" "/auth/login" '{"email":"test@example.com"}' "Missing Password in Login"

# Test 4: Unauthorized Access to Protected Endpoint
test_endpoint "GET" "/submissions" "" "Unauthorized Access to Submissions"

# Test 5: Invalid User ID
test_endpoint "GET" "/users/invalid-uuid" "" "Invalid User ID Format"

# Test 6: Non-existent User
test_endpoint "GET" "/users/550e8400-e29b-41d4-a716-446655440999" "" "Non-existent User"

# Test 7: Invalid Submission ID
test_endpoint "GET" "/submissions/invalid-id" "" "Invalid Submission ID"

# Test 8: Missing Required Fields in Registration
test_endpoint "POST" "/auth/register" '{"email":"test@example.com"}' "Missing Required Fields in Registration"

# Test 9: Invalid Email Format
test_endpoint "POST" "/auth/register" '{"email":"invalid-email","password":"password123","firstName":"Test","lastName":"User","role":"NODAL_OFFICER","stateUt":"Test"}' "Invalid Email Format"

# Test 10: Invalid Role
test_endpoint "POST" "/auth/register" '{"email":"test@example.com","password":"password123","firstName":"Test","lastName":"User","role":"INVALID_ROLE","stateUt":"Test"}' "Invalid Role"

# Test 11: File Upload Without File
test_endpoint "POST" "/file/upload" "" "File Upload Without File"

# Test 12: Dashboard Access Without Auth
test_endpoint "GET" "/dashboard" "" "Dashboard Access Without Authentication"

# Test 13: Report Access Without Auth
test_endpoint "GET" "/report" "" "Report Access Without Authentication"

# Test 14: Audit Logs Access Without Auth
test_endpoint "GET" "/audit" "" "Audit Logs Access Without Authentication"

# Test 15: Invalid HTTP Method
test_endpoint "DELETE" "/health" "" "Invalid HTTP Method on Health Endpoint"

echo ""
echo "🎉 Error handling tests completed!"
echo ""
echo "📋 Summary:"
echo "- All endpoints should return proper error responses"
echo "- Error messages should be user-friendly"
echo "- Status codes should be appropriate"
echo "- Response format should be consistent"
echo ""
echo "🔍 Check the responses above to verify error handling is working correctly."
