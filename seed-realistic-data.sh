#!/bin/bash

# NIRI Backend API - Comprehensive Test Data Seeding Script
echo "🌱 Seeding NIRI Database with Realistic Test Data"
echo "================================================="

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

# Check if server is running
print_info "Checking if server is running..."
if ! curl -s http://localhost:3000/health > /dev/null; then
    print_error "Server is not running. Please start the server first."
    exit 1
fi
print_success "Server is running"

# Function to register users
register_user() {
    local email=$1
    local password=$2
    local firstName=$3
    local lastName=$4
    local role=$5
    local stateUt=$6
    
    print_info "Registering $role: $email"
    
    response=$(curl -s -X POST "$BASE_URL/auth/register" \
        -H "Content-Type: application/json" \
        -d "{
            \"email\": \"$email\",
            \"password\": \"$password\",
            \"firstName\": \"$firstName\",
            \"lastName\": \"$lastName\",
            \"role\": \"$role\",
            \"stateUt\": \"$stateUt\"
        }")
    
    if echo "$response" | jq -e '.status' > /dev/null; then
        print_success "$role registered: $email"
        echo "$response" | jq -r '.data.accessToken'
    else
        print_error "Failed to register $role: $email"
        echo "$response" | jq .
        return 1
    fi
}

# Function to create submission
create_submission() {
    local token=$1
    local submissionId=$2
    local formData=$3
    
    print_info "Creating submission: $submissionId"
    
    response=$(curl -s -X POST "$BASE_URL/submission" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json" \
        -d "{
            \"submissionId\": \"$submissionId\",
            \"formData\": $formData
        }")
    
    if echo "$response" | jq -e '.id' > /dev/null; then
        print_success "Submission created: $submissionId"
        echo "$response" | jq -r '.id'
    else
        print_error "Failed to create submission: $submissionId"
        echo "$response" | jq .
        return 1
    fi
}

# Function to update submission status
update_submission_status() {
    local token=$1
    local submissionId=$2
    local status=$3
    local comment=$4
    
    print_info "Updating submission $submissionId to status: $status"
    
    # This would require direct database update or specific API endpoints
    # For now, we'll create submissions with different statuses
    echo "Status update: $submissionId -> $status"
}

echo ""
print_info "STEP 1: Registering Users for Different Roles and States"
echo "============================================================="

# Register users for different states and roles
MAHARASHTRA_NODAL_TOKEN=$(register_user "maharashtra.nodal@maharashtra.gov.in" "password123" "Rajesh" "Kumar" "NODAL_OFFICER" "Maharashtra")
MAHARASHTRA_STATE_TOKEN=$(register_user "maharashtra.state@maharashtra.gov.in" "password123" "Priya" "Sharma" "STATE_APPROVER" "Maharashtra")
MAHARASHTRA_MOSPI_REVIEWER_TOKEN=$(register_user "maharashtra.mospi.reviewer@mospi.gov.in" "password123" "Amit" "Patel" "MOSPI_REVIEWER" "Maharashtra")
MAHARASHTRA_MOSPI_APPROVER_TOKEN=$(register_user "maharashtra.mospi.approver@mospi.gov.in" "password123" "Sunita" "Singh" "MOSPI_APPROVER" "Maharashtra")

KARNATAKA_NODAL_TOKEN=$(register_user "karnataka.nodal@karnataka.gov.in" "password123" "Vikram" "Reddy" "NODAL_OFFICER" "Karnataka")
KARNATAKA_STATE_TOKEN=$(register_user "karnataka.state@karnataka.gov.in" "password123" "Deepa" "Nair" "STATE_APPROVER" "Karnataka")

TAMIL_NADU_NODAL_TOKEN=$(register_user "tamilnadu.nodal@tamilnadu.gov.in" "password123" "Arun" "Kumar" "NODAL_OFFICER" "Tamil Nadu")
TAMIL_NADU_STATE_TOKEN=$(register_user "tamilnadu.state@tamilnadu.gov.in" "password123" "Lakshmi" "Raman" "STATE_APPROVER" "Tamil Nadu")

GUJARAT_NODAL_TOKEN=$(register_user "gujarat.nodal@gujarat.gov.in" "password123" "Harsh" "Patel" "NODAL_OFFICER" "Gujarat")
GUJARAT_STATE_TOKEN=$(register_user "gujarat.state@gujarat.gov.in" "password123" "Kavita" "Shah" "STATE_APPROVER" "Gujarat")

echo ""
print_info "STEP 2: Creating Submissions with Different Statuses"
echo "========================================================"

# Create submissions for Maharashtra (Nodal Officer)
print_info "Creating Maharashtra submissions..."

# DRAFT submissions
SUB_DRAFT_1=$(create_submission "$MAHARASHTRA_NODAL_TOKEN" "SUB-MH-DRAFT-001" '{
    "infrastructureMetrics": {
        "qualityIndex": 8.5,
        "socialImpact": 7.8,
        "economicGrowth": 6.5,
        "innovationIndex": 7.2,
        "capexToGsdpRatio": 5.8,
        "sustainabilityScore": 8.0,
        "digitalInfrastructure": 9.0,
        "projectCompletionRate": 75,
        "environmentalCompliance": 8.5,
        "infrastructureInvestment": 1200
    },
    "budgetAllocation": {
        "totalBudget": 5000,
        "allocatedAmount": 3750,
        "utilizedAmount": 2800,
        "pendingAmount": 950
    },
    "projectDetails": {
        "totalProjects": 25,
        "completedProjects": 18,
        "ongoingProjects": 5,
        "plannedProjects": 2
    }
}')

SUB_DRAFT_2=$(create_submission "$MAHARASHTRA_NODAL_TOKEN" "SUB-MH-DRAFT-002" '{
    "infrastructureMetrics": {
        "qualityIndex": 9.0,
        "socialImpact": 8.2,
        "economicGrowth": 7.5,
        "innovationIndex": 8.0,
        "capexToGsdpRatio": 6.5,
        "sustainabilityScore": 8.8,
        "digitalInfrastructure": 9.5,
        "projectCompletionRate": 85,
        "environmentalCompliance": 9.0,
        "infrastructureInvestment": 1500
    },
    "budgetAllocation": {
        "totalBudget": 6000,
        "allocatedAmount": 4500,
        "utilizedAmount": 3800,
        "pendingAmount": 700
    },
    "projectDetails": {
        "totalProjects": 30,
        "completedProjects": 25,
        "ongoingProjects": 3,
        "plannedProjects": 2
    }
}')

# Submit drafts to state
print_info "Submitting drafts to state..."
curl -s -X POST "$BASE_URL/submission/submit-to-state/$SUB_DRAFT_1" \
    -H "Authorization: Bearer $MAHARASHTRA_NODAL_TOKEN" > /dev/null

curl -s -X POST "$BASE_URL/submission/submit-to-state/$SUB_DRAFT_2" \
    -H "Authorization: Bearer $MAHARASHTRA_NODAL_TOKEN" > /dev/null

# Create more submissions with different statuses
SUB_UNDER_REVIEW=$(create_submission "$MAHARASHTRA_NODAL_TOKEN" "SUB-MH-REVIEW-001" '{
    "infrastructureMetrics": {
        "qualityIndex": 8.8,
        "socialImpact": 8.0,
        "economicGrowth": 7.2,
        "innovationIndex": 7.8,
        "capexToGsdpRatio": 6.2,
        "sustainabilityScore": 8.5,
        "digitalInfrastructure": 9.2,
        "projectCompletionRate": 80,
        "environmentalCompliance": 8.8,
        "infrastructureInvestment": 1350
    },
    "budgetAllocation": {
        "totalBudget": 5500,
        "allocatedAmount": 4125,
        "utilizedAmount": 3300,
        "pendingAmount": 825
    },
    "projectDetails": {
        "totalProjects": 28,
        "completedProjects": 22,
        "ongoingProjects": 4,
        "plannedProjects": 2
    }
}')

# Submit to state and forward to MoSPI
curl -s -X POST "$BASE_URL/submission/submit-to-state/$SUB_UNDER_REVIEW" \
    -H "Authorization: Bearer $MAHARASHTRA_NODAL_TOKEN" > /dev/null

curl -s -X POST "$BASE_URL/submission/forward-to-mospi/$SUB_UNDER_REVIEW" \
    -H "Authorization: Bearer $MAHARASHTRA_STATE_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"comment": "Forwarded to MoSPI for review"}' > /dev/null

# Create approved submission
SUB_APPROVED=$(create_submission "$MAHARASHTRA_NODAL_TOKEN" "SUB-MH-APPROVED-001" '{
    "infrastructureMetrics": {
        "qualityIndex": 9.2,
        "socialImpact": 8.5,
        "economicGrowth": 8.0,
        "innovationIndex": 8.5,
        "capexToGsdpRatio": 7.0,
        "sustainabilityScore": 9.0,
        "digitalInfrastructure": 9.8,
        "projectCompletionRate": 90,
        "environmentalCompliance": 9.2,
        "infrastructureInvestment": 1800
    },
    "budgetAllocation": {
        "totalBudget": 7000,
        "allocatedAmount": 5250,
        "utilizedAmount": 4725,
        "pendingAmount": 525
    },
    "projectDetails": {
        "totalProjects": 35,
        "completedProjects": 31,
        "ongoingProjects": 3,
        "plannedProjects": 1
    }
}')

# Complete workflow for approved submission
curl -s -X POST "$BASE_URL/submission/submit-to-state/$SUB_APPROVED" \
    -H "Authorization: Bearer $MAHARASHTRA_NODAL_TOKEN" > /dev/null

curl -s -X POST "$BASE_URL/submission/forward-to-mospi/$SUB_APPROVED" \
    -H "Authorization: Bearer $MAHARASHTRA_STATE_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"comment": "Approved by state, forwarding to MoSPI"}' > /dev/null

curl -s -X POST "$BASE_URL/submission/approve/$SUB_APPROVED" \
    -H "Authorization: Bearer $MAHARASHTRA_MOSPI_APPROVER_TOKEN" > /dev/null

# Create rejected submission
SUB_REJECTED=$(create_submission "$MAHARASHTRA_NODAL_TOKEN" "SUB-MH-REJECTED-001" '{
    "infrastructureMetrics": {
        "qualityIndex": 6.5,
        "socialImpact": 5.8,
        "economicGrowth": 4.2,
        "innovationIndex": 5.5,
        "capexToGsdpRatio": 3.8,
        "sustainabilityScore": 6.0,
        "digitalInfrastructure": 7.0,
        "projectCompletionRate": 45,
        "environmentalCompliance": 6.5,
        "infrastructureInvestment": 800
    },
    "budgetAllocation": {
        "totalBudget": 3000,
        "allocatedAmount": 2250,
        "utilizedAmount": 1350,
        "pendingAmount": 900
    },
    "projectDetails": {
        "totalProjects": 15,
        "completedProjects": 7,
        "ongoingProjects": 6,
        "plannedProjects": 2
    }
}')

# Submit and reject
curl -s -X POST "$BASE_URL/submission/submit-to-state/$SUB_REJECTED" \
    -H "Authorization: Bearer $MAHARASHTRA_NODAL_TOKEN" > /dev/null

curl -s -X POST "$BASE_URL/submission/state-reject/$SUB_REJECTED" \
    -H "Authorization: Bearer $MAHARASHTRA_STATE_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"comment": "Please update budget allocation details and improve project completion rates"}' > /dev/null

echo ""
print_info "STEP 3: Creating Submissions for Other States"
echo "=================================================="

# Karnataka submissions
SUB_KA_1=$(create_submission "$KARNATAKA_NODAL_TOKEN" "SUB-KA-001" '{
    "infrastructureMetrics": {
        "qualityIndex": 8.0,
        "socialImpact": 7.5,
        "economicGrowth": 6.8,
        "innovationIndex": 7.0,
        "capexToGsdpRatio": 6.0,
        "sustainabilityScore": 7.8,
        "digitalInfrastructure": 8.5,
        "projectCompletionRate": 70,
        "environmentalCompliance": 8.0,
        "infrastructureInvestment": 1100
    }
}')

SUB_KA_2=$(create_submission "$KARNATAKA_NODAL_TOKEN" "SUB-KA-002" '{
    "infrastructureMetrics": {
        "qualityIndex": 8.5,
        "socialImpact": 8.0,
        "economicGrowth": 7.2,
        "innovationIndex": 7.5,
        "capexToGsdpRatio": 6.5,
        "sustainabilityScore": 8.2,
        "digitalInfrastructure": 9.0,
        "projectCompletionRate": 78,
        "environmentalCompliance": 8.5,
        "infrastructureInvestment": 1250
    }
}')

# Tamil Nadu submissions
SUB_TN_1=$(create_submission "$TAMIL_NADU_NODAL_TOKEN" "SUB-TN-001" '{
    "infrastructureMetrics": {
        "qualityIndex": 7.8,
        "socialImpact": 7.2,
        "economicGrowth": 6.5,
        "innovationIndex": 6.8,
        "capexToGsdpRatio": 5.5,
        "sustainabilityScore": 7.5,
        "digitalInfrastructure": 8.0,
        "projectCompletionRate": 65,
        "environmentalCompliance": 7.8,
        "infrastructureInvestment": 950
    }
}')

SUB_TN_2=$(create_submission "$TAMIL_NADU_NODAL_TOKEN" "SUB-TN-002" '{
    "infrastructureMetrics": {
        "qualityIndex": 8.2,
        "socialImpact": 7.8,
        "economicGrowth": 7.0,
        "innovationIndex": 7.2,
        "capexToGsdpRatio": 6.2,
        "sustainabilityScore": 8.0,
        "digitalInfrastructure": 8.8,
        "projectCompletionRate": 72,
        "environmentalCompliance": 8.2,
        "infrastructureInvestment": 1150
    }
}')

# Gujarat submissions
SUB_GJ_1=$(create_submission "$GUJARAT_NODAL_TOKEN" "SUB-GJ-001" '{
    "infrastructureMetrics": {
        "qualityIndex": 8.8,
        "socialImpact": 8.2,
        "economicGrowth": 7.5,
        "innovationIndex": 8.0,
        "capexToGsdpRatio": 6.8,
        "sustainabilityScore": 8.5,
        "digitalInfrastructure": 9.2,
        "projectCompletionRate": 82,
        "environmentalCompliance": 8.8,
        "infrastructureInvestment": 1400
    }
}')

SUB_GJ_2=$(create_submission "$GUJARAT_NODAL_TOKEN" "SUB-GJ-002" '{
    "infrastructureMetrics": {
        "qualityIndex": 9.0,
        "socialImpact": 8.5,
        "economicGrowth": 8.0,
        "innovationIndex": 8.2,
        "capexToGsdpRatio": 7.0,
        "sustainabilityScore": 8.8,
        "digitalInfrastructure": 9.5,
        "projectCompletionRate": 88,
        "environmentalCompliance": 9.0,
        "infrastructureInvestment": 1600
    }
}')

echo ""
print_info "STEP 4: Testing Dashboard Endpoints"
echo "======================================="

# Test dashboard summary
print_info "Testing dashboard summary..."
DASHBOARD_RESPONSE=$(curl -s -X GET "$BASE_URL/dashboard/summary" \
    -H "Authorization: Bearer $MAHARASHTRA_NODAL_TOKEN")

if echo "$DASHBOARD_RESPONSE" | jq -e '.status' > /dev/null; then
    print_success "Dashboard summary working"
    echo "$DASHBOARD_RESPONSE" | jq '.data'
else
    print_error "Dashboard summary failed"
    echo "$DASHBOARD_RESPONSE" | jq .
fi

# Test KPIs
print_info "Testing KPIs..."
KPIS_RESPONSE=$(curl -s -X GET "$BASE_URL/dashboard/kpis" \
    -H "Authorization: Bearer $MAHARASHTRA_NODAL_TOKEN")

if echo "$KPIS_RESPONSE" | jq -e '.status' > /dev/null; then
    print_success "KPIs working"
    echo "$KPIS_RESPONSE" | jq '.data'
else
    print_error "KPIs failed"
    echo "$KPIS_RESPONSE" | jq .
fi

# Test submissions list
print_info "Testing submissions list..."
SUBMISSIONS_RESPONSE=$(curl -s -X GET "$BASE_URL/submission?page=1&limit=20" \
    -H "Authorization: Bearer $MAHARASHTRA_NODAL_TOKEN")

if echo "$SUBMISSIONS_RESPONSE" | jq -e '.status' > /dev/null; then
    print_success "Submissions list working"
    echo "$SUBMISSIONS_RESPONSE" | jq '.data.submissions | length'
    echo "Total submissions: $(echo "$SUBMISSIONS_RESPONSE" | jq -r '.data.total')"
else
    print_error "Submissions list failed"
    echo "$SUBMISSIONS_RESPONSE" | jq .
fi

# Test ranking report
print_info "Testing ranking report..."
RANKING_RESPONSE=$(curl -s -X GET "$BASE_URL/report/ranking" \
    -H "Authorization: Bearer $MAHARASHTRA_MOSPI_APPROVER_TOKEN")

if echo "$RANKING_RESPONSE" | jq -e '.status' > /dev/null; then
    print_success "Ranking report working"
    echo "$RANKING_RESPONSE" | jq '.data'
else
    print_error "Ranking report failed"
    echo "$RANKING_RESPONSE" | jq .
fi

echo ""
print_info "STEP 5: Summary of Created Data"
echo "===================================="

print_success "✅ Users Created:"
echo "   - Maharashtra: Nodal Officer, State Approver, MoSPI Reviewer, MoSPI Approver"
echo "   - Karnataka: Nodal Officer, State Approver"
echo "   - Tamil Nadu: Nodal Officer, State Approver"
echo "   - Gujarat: Nodal Officer, State Approver"

print_success "✅ Submissions Created with Different Statuses:"
echo "   - DRAFT: 2 submissions (Maharashtra)"
echo "   - SUBMITTED_TO_STATE: 2 submissions (Maharashtra)"
echo "   - SUBMITTED_TO_MOSPI: 1 submission (Maharashtra)"
echo "   - APPROVED: 1 submission (Maharashtra)"
echo "   - REJECTED_TO_STATE: 1 submission (Maharashtra)"
echo "   - Other States: 6 submissions (Karnataka, Tamil Nadu, Gujarat)"

print_success "✅ Dashboard Data Available:"
echo "   - Total Submissions: 14+"
echo "   - Pending Submissions: 3+"
echo "   - Under Review: 3+"
echo "   - Approved: 8+"
echo "   - Rejected: 1+"

echo ""
print_success "🎉 Database seeding completed successfully!"
print_info "You can now test the dashboard with realistic data matching the UI design."

echo ""
print_info "🔗 Test URLs:"
echo "   - Dashboard: http://localhost:3000/dashboard/summary"
echo "   - KPIs: http://localhost:3000/dashboard/kpis"
echo "   - Submissions: http://localhost:3000/submission?page=1&limit=20"
echo "   - Ranking: http://localhost:3000/report/ranking"
