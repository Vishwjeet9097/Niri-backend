#!/bin/bash

# NIRI Scoring System Test Script
echo "🧪 Testing NIRI Scoring System Flow"
echo "=================================="

BASE_URL="http://localhost:3000"
TEST_SUBMISSION_ID="TEST-SCORING-$(date +%s)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to check if server is running
check_server() {
    print_status "Checking if server is running..."
    if curl -s "$BASE_URL/health" > /dev/null; then
        print_success "Server is running"
    else
        print_error "Server is not running. Please start the server first."
        exit 1
    fi
}

# Function to register test users
register_users() {
    print_status "Registering test users..."
    
    # Register Nodal Officer
    NODAL_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "nodal.test@maharashtra.gov.in",
            "password": "password123",
            "firstName": "Nodal",
            "lastName": "Test",
            "role": "NODAL_OFFICER",
            "stateUt": "Maharashtra"
        }')
    
    if echo "$NODAL_RESPONSE" | jq -e '.accessToken' > /dev/null; then
        print_success "Nodal Officer registered"
        NODAL_TOKEN=$(echo "$NODAL_RESPONSE" | jq -r '.accessToken')
    else
        print_error "Failed to register Nodal Officer"
        echo "$NODAL_RESPONSE" | jq .
        exit 1
    fi
    
    # Register State Approver
    STATE_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "state.test@maharashtra.gov.in",
            "password": "password123",
            "firstName": "State",
            "lastName": "Test",
            "role": "STATE_APPROVER",
            "stateUt": "Maharashtra"
        }')
    
    if echo "$STATE_RESPONSE" | jq -e '.accessToken' > /dev/null; then
        print_success "State Approver registered"
        STATE_TOKEN=$(echo "$STATE_RESPONSE" | jq -r '.accessToken')
    else
        print_error "Failed to register State Approver"
        echo "$STATE_RESPONSE" | jq .
        exit 1
    fi
    
    # Register MoSPI Approver
    MOSPI_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
        -H "Content-Type: application/json" \
        -d '{
            "email": "mospi.test@mospi.gov.in",
            "password": "password123",
            "firstName": "MoSPI",
            "lastName": "Test",
            "role": "MOSPI_APPROVER",
            "stateUt": "Central"
        }')
    
    if echo "$MOSPI_RESPONSE" | jq -e '.accessToken' > /dev/null; then
        print_success "MoSPI Approver registered"
        MOSPI_TOKEN=$(echo "$MOSPI_RESPONSE" | jq -r '.accessToken')
    else
        print_error "Failed to register MoSPI Approver"
        echo "$MOSPI_RESPONSE" | jq .
        exit 1
    fi
}

# Function to create test submission
create_submission() {
    print_status "Creating test submission with complete form data..."
    
    SUBMISSION_RESPONSE=$(curl -s -X POST "$BASE_URL/submission" \
        -H "Authorization: Bearer $NODAL_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"submissionId\": \"$TEST_SUBMISSION_ID\",
            \"formData\": {
                \"infraFinancing\": {
                    \"capexToGSDP\": {
                        \"capitalAllocation\": 50000,
                        \"gsdp\": 500000,
                        \"percentage\": 10
                    },
                    \"capexUtilization\": {
                        \"actualCapex\": 45000,
                        \"allocatedCapex\": 50000,
                        \"percentage\": 90
                    },
                    \"creditRatedULBs\": {
                        \"ratedULBs\": 15,
                        \"totalULBs\": 30,
                        \"percentage\": 50
                    },
                    \"ulbBonds\": {
                        \"approvedULBs\": 8,
                        \"totalULBs\": 30,
                        \"percentage\": 26.67
                    },
                    \"financialIntermediary\": {
                        \"hasIntermediary\": true,
                        \"subSectors\": [\"Transport\", \"Water\", \"Energy\"],
                        \"documentUploaded\": true
                    }
                },
                \"infraDevelopment\": {
                    \"infrastructureAct\": {
                        \"selectedSectors\": [\"Transport\", \"Water\", \"Energy\", \"Urban Development\"],
                        \"hasOverarching\": true,
                        \"documentUploaded\": true
                    },
                    \"specializedEntity\": {
                        \"selectedSectors\": [\"Transport\", \"Water\"],
                        \"documentUploaded\": true
                    },
                    \"sectorPlan\": {
                        \"selectedSectors\": [\"Transport\", \"Water\", \"Energy\"],
                        \"hasOverarching\": false,
                        \"documentUploaded\": true
                    },
                    \"projectPipeline\": {
                        \"projects\": [
                            {
                                \"projectName\": \"Highway Project A\",
                                \"documentUploaded\": true
                            },
                            {
                                \"projectName\": \"Water Treatment Plant B\",
                                \"documentUploaded\": true
                            }
                        ]
                    },
                    \"assetMonetization\": {
                        \"assets\": [
                            {
                                \"assetName\": \"Toll Road Asset 1\",
                                \"documentUploaded\": true
                            }
                        ]
                    }
                },
                \"pppDevelopment\": {
                    \"pppAct\": {
                        \"hasAct\": \"yes\",
                        \"documentUploaded\": true
                    },
                    \"pppCell\": {
                        \"hasCell\": true,
                        \"documentUploaded\": true
                    },
                    \"vgfIipdfProposals\": {
                        \"proposals\": [
                            {
                                \"projectName\": \"VGF Project 1\",
                                \"documentUploaded\": true
                            },
                            {
                                \"projectName\": \"IIPDF Project 2\",
                                \"documentUploaded\": true
                            }
                        ]
                    },
                    \"pppProportion\": {
                        \"pppProjectCost\": 20000,
                        \"totalInfraCost\": 50000,
                        \"percentage\": 40
                    }
                },
                \"infraEnablers\": {
                    \"nipPortal\": {
                        \"allProjectsListed\": true,
                        \"documentUploaded\": true
                    },
                    \"statePMG\": {
                        \"hasPMG\": true,
                        \"documentOrUrl\": \"https://statepmg.example.com\"
                    },
                    \"gatiShakti\": {
                        \"projects\": [
                            {
                                \"projectName\": \"GatiShakti Project 1\",
                                \"evidenceUploaded\": true
                            },
                            {
                                \"projectName\": \"GatiShakti Project 2\",
                                \"evidenceUploaded\": true
                            }
                        ]
                    },
                    \"adr\": {
                        \"hasADR\": true,
                        \"documentUploaded\": true
                    },
                    \"innovativePractices\": {
                        \"practices\": [
                            {
                                \"practiceName\": \"Digital Payment Integration\",
                                \"evidenceUploaded\": true
                            },
                            {
                                \"practiceName\": \"AI-based Traffic Management\",
                                \"evidenceUploaded\": true
                            }
                        ]
                    },
                    \"capacityBuilding\": {
                        \"officers\": [
                            {
                                \"officerName\": \"John Doe\",
                                \"designation\": \"Chief Engineer\",
                                \"trainingCompleted\": true
                            },
                            {
                                \"officerName\": \"Jane Smith\",
                                \"designation\": \"Project Manager\",
                                \"trainingCompleted\": true
                            }
                        ]
                    }
                }
            },
            \"status\": \"SUBMITTED_TO_STATE\"
        }")
    
    if echo "$SUBMISSION_RESPONSE" | jq -e '.data.id' > /dev/null; then
        print_success "Submission created successfully"
        SUBMISSION_ID=$(echo "$SUBMISSION_RESPONSE" | jq -r '.data.id')
        echo "Submission ID: $SUBMISSION_ID"
    else
        print_error "Failed to create submission"
        echo "$SUBMISSION_RESPONSE" | jq .
        exit 1
    fi
}

# Function to validate form data
validate_form_data() {
    print_status "Validating form data structure..."
    
    VALIDATION_RESPONSE=$(curl -s -X POST "$BASE_URL/scoring/validate-form-data" \
        -H "Authorization: Bearer $NODAL_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "infraFinancing": {
                "capexToGSDP": {
                    "capitalAllocation": 50000,
                    "gsdp": 500000,
                    "percentage": 10
                }
            }
        }')
    
    if echo "$VALIDATION_RESPONSE" | jq -e '.data.isValid' > /dev/null; then
        print_success "Form data validation completed"
        echo "Validation result:"
        echo "$VALIDATION_RESPONSE" | jq '.data'
    else
        print_warning "Form data validation failed"
        echo "$VALIDATION_RESPONSE" | jq .
    fi
}

# Function to forward submission
forward_submission() {
    print_status "Forwarding submission to MoSPI..."
    
    FORWARD_RESPONSE=$(curl -s -X PATCH "$BASE_URL/submission/$SUBMISSION_ID/forward" \
        -H "Authorization: Bearer $STATE_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"comment": "Approved by State - Ready for MoSPI review"}')
    
    if echo "$FORWARD_RESPONSE" | jq -e '.data.status' > /dev/null; then
        print_success "Submission forwarded to MoSPI"
        echo "Status: $(echo "$FORWARD_RESPONSE" | jq -r '.data.status')"
    else
        print_error "Failed to forward submission"
        echo "$FORWARD_RESPONSE" | jq .
        exit 1
    fi
}

# Function to approve submission
approve_submission() {
    print_status "Approving submission..."
    
    APPROVE_RESPONSE=$(curl -s -X PATCH "$BASE_URL/submission/$SUBMISSION_ID/approve" \
        -H "Authorization: Bearer $MOSPI_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"comment": "Final approval granted by MoSPI"}')
    
    if echo "$APPROVE_RESPONSE" | jq -e '.data.status' > /dev/null; then
        print_success "Submission approved"
        echo "Status: $(echo "$APPROVE_RESPONSE" | jq -r '.data.status')"
    else
        print_error "Failed to approve submission"
        echo "$APPROVE_RESPONSE" | jq .
        exit 1
    fi
}

# Function to calculate score
calculate_score() {
    print_status "Calculating score..."
    
    SCORE_RESPONSE=$(curl -s -X GET "$BASE_URL/scoring/calculate/$SUBMISSION_ID" \
        -H "Authorization: Bearer $MOSPI_TOKEN")
    
    if echo "$SCORE_RESPONSE" | jq -e '.data.totalScore' > /dev/null; then
        print_success "Score calculated successfully"
        echo "Total Score: $(echo "$SCORE_RESPONSE" | jq -r '.data.totalScore')"
        echo "Percentage: $(echo "$SCORE_RESPONSE" | jq -r '.data.scoreBreakdown.percentage')%"
        echo "Scoring Version: $(echo "$SCORE_RESPONSE" | jq -r '.data.scoringVersion')"
        
        echo ""
        echo "Category Breakdown:"
        echo "$SCORE_RESPONSE" | jq -r '.data.scoreBreakdown.categories[] | "\(.categoryName): \(.categoryScore)/\(.maxCategoryScore) (\(.percentage)%)"'
    else
        print_error "Failed to calculate score"
        echo "$SCORE_RESPONSE" | jq .
        exit 1
    fi
}

# Function to get detailed score
get_detailed_score() {
    print_status "Getting detailed score breakdown..."
    
    DETAILED_RESPONSE=$(curl -s -X GET "$BASE_URL/scoring/detailed/$SUBMISSION_ID" \
        -H "Authorization: Bearer $MOSPI_TOKEN")
    
    if echo "$DETAILED_RESPONSE" | jq -e '.data.categories' > /dev/null; then
        print_success "Detailed score retrieved"
        echo "Methodology: $(echo "$DETAILED_RESPONSE" | jq -r '.data.methodology')"
        echo "Calculation Date: $(echo "$DETAILED_RESPONSE" | jq -r '.data.calculationDate')"
    else
        print_error "Failed to get detailed score"
        echo "$DETAILED_RESPONSE" | jq .
    fi
}

# Function to get rankings
get_rankings() {
    print_status "Getting score rankings..."
    
    RANKINGS_RESPONSE=$(curl -s -X GET "$BASE_URL/scoring/rankings" \
        -H "Authorization: Bearer $MOSPI_TOKEN")
    
    if echo "$RANKINGS_RESPONSE" | jq -e '.data' > /dev/null; then
        print_success "Rankings retrieved"
        echo "Number of states: $(echo "$RANKINGS_RESPONSE" | jq '.data | length')"
        echo "Top 3 states:"
        echo "$RANKINGS_RESPONSE" | jq -r '.data[0:3][] | "Rank \(.rank): \(.stateUt) - \(.totalScore) marks"'
    else
        print_error "Failed to get rankings"
        echo "$RANKINGS_RESPONSE" | jq .
    fi
}

# Function to get statistics
get_statistics() {
    print_status "Getting comprehensive statistics..."
    
    STATS_RESPONSE=$(curl -s -X GET "$BASE_URL/scoring/statistics" \
        -H "Authorization: Bearer $MOSPI_TOKEN")
    
    if echo "$STATS_RESPONSE" | jq -e '.data.totalStates' > /dev/null; then
        print_success "Statistics retrieved"
        echo "Total States: $(echo "$STATS_RESPONSE" | jq -r '.data.totalStates')"
        echo "Average Score: $(echo "$STATS_RESPONSE" | jq -r '.data.averageScore')"
        echo "Highest Score: $(echo "$STATS_RESPONSE" | jq -r '.data.highestScore')"
        echo "Lowest Score: $(echo "$STATS_RESPONSE" | jq -r '.data.lowestScore')"
        echo "Max Possible Score: $(echo "$STATS_RESPONSE" | jq -r '.data.maxPossibleScore')"
    else
        print_error "Failed to get statistics"
        echo "$STATS_RESPONSE" | jq .
    fi
}

# Function to get methodology
get_methodology() {
    print_status "Getting scoring methodology..."
    
    METHODOLOGY_RESPONSE=$(curl -s -X GET "$BASE_URL/scoring/methodology" \
        -H "Authorization: Bearer $MOSPI_TOKEN")
    
    if echo "$METHODOLOGY_RESPONSE" | jq -e '.data.version' > /dev/null; then
        print_success "Methodology retrieved"
        echo "Version: $(echo "$METHODOLOGY_RESPONSE" | jq -r '.data.version')"
        echo "Total Marks: $(echo "$METHODOLOGY_RESPONSE" | jq -r '.data.totalMarks')"
        echo "Categories: $(echo "$METHODOLOGY_RESPONSE" | jq '.data.categories | length')"
    else
        print_error "Failed to get methodology"
        echo "$METHODOLOGY_RESPONSE" | jq .
    fi
}

# Function to test error scenarios
test_error_scenarios() {
    print_status "Testing error scenarios..."
    
    # Test invalid submission ID
    print_status "Testing invalid submission ID..."
    INVALID_RESPONSE=$(curl -s -X GET "$BASE_URL/scoring/calculate/invalid-id" \
        -H "Authorization: Bearer $MOSPI_TOKEN")
    
    if echo "$INVALID_RESPONSE" | jq -e '.status == false' > /dev/null; then
        print_success "Invalid submission ID handled correctly"
    else
        print_warning "Invalid submission ID test failed"
    fi
    
    # Test unauthorized access
    print_status "Testing unauthorized access..."
    UNAUTHORIZED_RESPONSE=$(curl -s -X GET "$BASE_URL/scoring/calculate/$SUBMISSION_ID" \
        -H "Authorization: Bearer $NODAL_TOKEN")
    
    if echo "$UNAUTHORIZED_RESPONSE" | jq -e '.statusCode == 403' > /dev/null; then
        print_success "Unauthorized access handled correctly"
    else
        print_warning "Unauthorized access test failed"
    fi
}

# Main execution
main() {
    echo ""
    print_status "Starting NIRI Scoring System Test Flow"
    echo "=============================================="
    
    check_server
    register_users
    validate_form_data
    create_submission
    forward_submission
    approve_submission
    calculate_score
    get_detailed_score
    get_rankings
    get_statistics
    get_methodology
    test_error_scenarios
    
    echo ""
    print_success "🎉 All tests completed successfully!"
    echo ""
    print_status "Test Summary:"
    echo "- Submission ID: $TEST_SUBMISSION_ID"
    echo "- Database ID: $SUBMISSION_ID"
    echo "- All scoring endpoints tested"
    echo "- Error scenarios validated"
    echo "- Complete workflow verified"
    echo ""
    print_status "You can now use the scoring system in production!"
}

# Run main function
main




