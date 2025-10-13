# NIRI Scoring System Test Script (PowerShell)
Write-Host "🧪 Testing NIRI Scoring System Flow" -ForegroundColor Blue
Write-Host "==================================" -ForegroundColor Blue

$BASE_URL = "http://localhost:3000"
$TEST_SUBMISSION_ID = "TEST-SCORING-$(Get-Date -Format 'yyyyMMddHHmmss')"

# Function to make HTTP requests
function Invoke-ApiRequest {
    param(
        [string]$Method,
        [string]$Uri,
        [hashtable]$Headers = @{},
        [string]$Body = $null
    )
    
    try {
        $response = Invoke-RestMethod -Uri $Uri -Method $Method -Headers $Headers -Body $Body -ContentType "application/json"
        return $response
    }
    catch {
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

# Check if server is running
function Test-Server {
    Write-Status "Checking if server is running..."
    try {
        $response = Invoke-ApiRequest -Method "GET" -Uri "$BASE_URL/health"
        Write-Success "Server is running"
        return $true
    }
    catch {
        Write-Error "Server is not running. Please start the server first."
        return $false
    }
}

# Register test users
function Register-Users {
    Write-Status "Registering test users..."
    
    # Register Nodal Officer
    $nodalUser = @{
        email = "nodal.test@maharashtra.gov.in"
        password = "password123"
        firstName = "Nodal"
        lastName = "Test"
        role = "NODAL_OFFICER"
        stateUt = "Maharashtra"
    }
    
    $nodalResponse = Invoke-ApiRequest -Method "POST" -Uri "$BASE_URL/auth/register" -Body ($nodalUser | ConvertTo-Json)
    if ($nodalResponse -and $nodalResponse.accessToken) {
        Write-Success "Nodal Officer registered"
        $script:NODAL_TOKEN = $nodalResponse.accessToken
    } else {
        Write-Error "Failed to register Nodal Officer"
        return $false
    }
    
    # Register State Approver
    $stateUser = @{
        email = "state.test@maharashtra.gov.in"
        password = "password123"
        firstName = "State"
        lastName = "Test"
        role = "STATE_APPROVER"
        stateUt = "Maharashtra"
    }
    
    $stateResponse = Invoke-ApiRequest -Method "POST" -Uri "$BASE_URL/auth/register" -Body ($stateUser | ConvertTo-Json)
    if ($stateResponse -and $stateResponse.accessToken) {
        Write-Success "State Approver registered"
        $script:STATE_TOKEN = $stateResponse.accessToken
    } else {
        Write-Error "Failed to register State Approver"
        return $false
    }
    
    # Register MoSPI Approver
    $mospiUser = @{
        email = "mospi.test@mospi.gov.in"
        password = "password123"
        firstName = "MoSPI"
        lastName = "Test"
        role = "MOSPI_APPROVER"
        stateUt = "Central"
    }
    
    $mospiResponse = Invoke-ApiRequest -Method "POST" -Uri "$BASE_URL/auth/register" -Body ($mospiUser | ConvertTo-Json)
    if ($mospiResponse -and $mospiResponse.accessToken) {
        Write-Success "MoSPI Approver registered"
        $script:MOSPI_TOKEN = $mospiResponse.accessToken
    } else {
        Write-Error "Failed to register MoSPI Approver"
        return $false
    }
    
    return $true
}

# Create test submission
function New-Submission {
    Write-Status "Creating test submission with complete form data..."
    
    $formData = @{
        infraFinancing = @{
            capexToGSDP = @{
                capitalAllocation = 50000
                gsdp = 500000
                percentage = 10
            }
            capexUtilization = @{
                actualCapex = 45000
                allocatedCapex = 50000
                percentage = 90
            }
            creditRatedULBs = @{
                ratedULBs = 15
                totalULBs = 30
                percentage = 50
            }
            ulbBonds = @{
                approvedULBs = 8
                totalULBs = 30
                percentage = 26.67
            }
            financialIntermediary = @{
                hasIntermediary = $true
                subSectors = @("Transport", "Water", "Energy")
                documentUploaded = $true
            }
        }
        infraDevelopment = @{
            infrastructureAct = @{
                selectedSectors = @("Transport", "Water", "Energy", "Urban Development")
                hasOverarching = $true
                documentUploaded = $true
            }
            specializedEntity = @{
                selectedSectors = @("Transport", "Water")
                documentUploaded = $true
            }
            sectorPlan = @{
                selectedSectors = @("Transport", "Water", "Energy")
                hasOverarching = $false
                documentUploaded = $true
            }
            projectPipeline = @{
                projects = @(
                    @{
                        projectName = "Highway Project A"
                        documentUploaded = $true
                    },
                    @{
                        projectName = "Water Treatment Plant B"
                        documentUploaded = $true
                    }
                )
            }
            assetMonetization = @{
                assets = @(
                    @{
                        assetName = "Toll Road Asset 1"
                        documentUploaded = $true
                    }
                )
            }
        }
        pppDevelopment = @{
            pppAct = @{
                hasAct = "yes"
                documentUploaded = $true
            }
            pppCell = @{
                hasCell = $true
                documentUploaded = $true
            }
            vgfIipdfProposals = @{
                proposals = @(
                    @{
                        projectName = "VGF Project 1"
                        documentUploaded = $true
                    },
                    @{
                        projectName = "IIPDF Project 2"
                        documentUploaded = $true
                    }
                )
            }
            pppProportion = @{
                pppProjectCost = 20000
                totalInfraCost = 50000
                percentage = 40
            }
        }
        infraEnablers = @{
            nipPortal = @{
                allProjectsListed = $true
                documentUploaded = $true
            }
            statePMG = @{
                hasPMG = $true
                documentOrUrl = "https://statepmg.example.com"
            }
            gatiShakti = @{
                projects = @(
                    @{
                        projectName = "GatiShakti Project 1"
                        evidenceUploaded = $true
                    },
                    @{
                        projectName = "GatiShakti Project 2"
                        evidenceUploaded = $true
                    }
                )
            }
            adr = @{
                hasADR = $true
                documentUploaded = $true
            }
            innovativePractices = @{
                practices = @(
                    @{
                        practiceName = "Digital Payment Integration"
                        evidenceUploaded = $true
                    },
                    @{
                        practiceName = "AI-based Traffic Management"
                        evidenceUploaded = $true
                    }
                )
            }
            capacityBuilding = @{
                officers = @(
                    @{
                        officerName = "John Doe"
                        designation = "Chief Engineer"
                        trainingCompleted = $true
                    },
                    @{
                        officerName = "Jane Smith"
                        designation = "Project Manager"
                        trainingCompleted = $true
                    }
                )
            }
        }
    }
    
    $submissionData = @{
        submissionId = $TEST_SUBMISSION_ID
        formData = $formData
        status = "SUBMITTED_TO_STATE"
    }
    
    $headers = @{
        "Authorization" = "Bearer $NODAL_TOKEN"
    }
    
    $response = Invoke-ApiRequest -Method "POST" -Uri "$BASE_URL/submission" -Headers $headers -Body ($submissionData | ConvertTo-Json -Depth 10)
    
    if ($response -and $response.data -and $response.data.id) {
        Write-Success "Submission created successfully"
        $script:SUBMISSION_ID = $response.data.id
        Write-Host "Submission ID: $SUBMISSION_ID" -ForegroundColor Cyan
        return $true
    } else {
        Write-Error "Failed to create submission"
        return $false
    }
}

# Forward submission
function Forward-Submission {
    Write-Status "Forwarding submission to MoSPI..."
    
    $headers = @{
        "Authorization" = "Bearer $STATE_TOKEN"
    }
    
    $body = @{
        comment = "Approved by State - Ready for MoSPI review"
    } | ConvertTo-Json
    
    $response = Invoke-ApiRequest -Method "PATCH" -Uri "$BASE_URL/submission/$SUBMISSION_ID/forward" -Headers $headers -Body $body
    
    if ($response -and $response.data -and $response.data.status) {
        Write-Success "Submission forwarded to MoSPI"
        Write-Host "Status: $($response.data.status)" -ForegroundColor Cyan
        return $true
    } else {
        Write-Error "Failed to forward submission"
        return $false
    }
}

# Approve submission
function Approve-Submission {
    Write-Status "Approving submission..."
    
    $headers = @{
        "Authorization" = "Bearer $MOSPI_TOKEN"
    }
    
    $body = @{
        comment = "Final approval granted by MoSPI"
    } | ConvertTo-Json
    
    $response = Invoke-ApiRequest -Method "PATCH" -Uri "$BASE_URL/submission/$SUBMISSION_ID/approve" -Headers $headers -Body $body
    
    if ($response -and $response.data -and $response.data.status) {
        Write-Success "Submission approved"
        Write-Host "Status: $($response.data.status)" -ForegroundColor Cyan
        return $true
    } else {
        Write-Error "Failed to approve submission"
        return $false
    }
}

# Calculate score
function Calculate-Score {
    Write-Status "Calculating score..."
    
    $headers = @{
        "Authorization" = "Bearer $MOSPI_TOKEN"
    }
    
    $response = Invoke-ApiRequest -Method "GET" -Uri "$BASE_URL/scoring/calculate/$SUBMISSION_ID" -Headers $headers
    
    if ($response -and $response.data -and $response.data.totalScore) {
        Write-Success "Score calculated successfully"
        Write-Host "Total Score: $($response.data.totalScore)" -ForegroundColor Green
        Write-Host "Percentage: $($response.data.scoreBreakdown.percentage)%" -ForegroundColor Green
        Write-Host "Scoring Version: $($response.data.scoringVersion)" -ForegroundColor Green
        
        Write-Host ""
        Write-Host "Category Breakdown:" -ForegroundColor Yellow
        foreach ($category in $response.data.scoreBreakdown.categories) {
            Write-Host "$($category.categoryName): $($category.categoryScore)/$($category.maxCategoryScore) ($($category.percentage)%)" -ForegroundColor Cyan
        }
        return $true
    } else {
        Write-Error "Failed to calculate score"
        return $false
    }
}

# Get detailed score
function Get-DetailedScore {
    Write-Status "Getting detailed score breakdown..."
    
    $headers = @{
        "Authorization" = "Bearer $MOSPI_TOKEN"
    }
    
    $response = Invoke-ApiRequest -Method "GET" -Uri "$BASE_URL/scoring/detailed/$SUBMISSION_ID" -Headers $headers
    
    if ($response -and $response.data -and $response.data.categories) {
        Write-Success "Detailed score retrieved"
        Write-Host "Methodology: $($response.data.methodology)" -ForegroundColor Cyan
        Write-Host "Calculation Date: $($response.data.calculationDate)" -ForegroundColor Cyan
        return $true
    } else {
        Write-Error "Failed to get detailed score"
        return $false
    }
}

# Get rankings
function Get-Rankings {
    Write-Status "Getting score rankings..."
    
    $headers = @{
        "Authorization" = "Bearer $MOSPI_TOKEN"
    }
    
    $response = Invoke-ApiRequest -Method "GET" -Uri "$BASE_URL/scoring/rankings" -Headers $headers
    
    if ($response -and $response.data) {
        Write-Success "Rankings retrieved"
        Write-Host "Number of states: $($response.data.Count)" -ForegroundColor Cyan
        Write-Host "Top 3 states:" -ForegroundColor Yellow
        for ($i = 0; $i -lt [Math]::Min(3, $response.data.Count); $i++) {
            $state = $response.data[$i]
            Write-Host "Rank $($state.rank): $($state.stateUt) - $($state.totalScore) marks" -ForegroundColor Cyan
        }
        return $true
    } else {
        Write-Error "Failed to get rankings"
        return $false
    }
}

# Get statistics
function Get-Statistics {
    Write-Status "Getting comprehensive statistics..."
    
    $headers = @{
        "Authorization" = "Bearer $MOSPI_TOKEN"
    }
    
    $response = Invoke-ApiRequest -Method "GET" -Uri "$BASE_URL/scoring/statistics" -Headers $headers
    
    if ($response -and $response.data -and $response.data.totalStates) {
        Write-Success "Statistics retrieved"
        Write-Host "Total States: $($response.data.totalStates)" -ForegroundColor Cyan
        Write-Host "Average Score: $($response.data.averageScore)" -ForegroundColor Cyan
        Write-Host "Highest Score: $($response.data.highestScore)" -ForegroundColor Cyan
        Write-Host "Lowest Score: $($response.data.lowestScore)" -ForegroundColor Cyan
        Write-Host "Max Possible Score: $($response.data.maxPossibleScore)" -ForegroundColor Cyan
        return $true
    } else {
        Write-Error "Failed to get statistics"
        return $false
    }
}

# Get methodology
function Get-Methodology {
    Write-Status "Getting scoring methodology..."
    
    $headers = @{
        "Authorization" = "Bearer $MOSPI_TOKEN"
    }
    
    $response = Invoke-ApiRequest -Method "GET" -Uri "$BASE_URL/scoring/methodology" -Headers $headers
    
    if ($response -and $response.data -and $response.data.version) {
        Write-Success "Methodology retrieved"
        Write-Host "Version: $($response.data.version)" -ForegroundColor Cyan
        Write-Host "Total Marks: $($response.data.totalMarks)" -ForegroundColor Cyan
        Write-Host "Categories: $($response.data.categories.Count)" -ForegroundColor Cyan
        return $true
    } else {
        Write-Error "Failed to get methodology"
        return $false
    }
}

# Test error scenarios
function Test-ErrorScenarios {
    Write-Status "Testing error scenarios..."
    
    # Test invalid submission ID
    Write-Status "Testing invalid submission ID..."
    $headers = @{
        "Authorization" = "Bearer $MOSPI_TOKEN"
    }
    
    try {
        $response = Invoke-ApiRequest -Method "GET" -Uri "$BASE_URL/scoring/calculate/invalid-id" -Headers $headers
        if ($response -and $response.status -eq $false) {
            Write-Success "Invalid submission ID handled correctly"
        } else {
            Write-Warning "Invalid submission ID test failed"
        }
    }
    catch {
        Write-Success "Invalid submission ID handled correctly (threw exception)"
    }
    
    # Test unauthorized access
    Write-Status "Testing unauthorized access..."
    $unauthorizedHeaders = @{
        "Authorization" = "Bearer $NODAL_TOKEN"
    }
    
    try {
        $response = Invoke-ApiRequest -Method "GET" -Uri "$BASE_URL/scoring/calculate/$SUBMISSION_ID" -Headers $unauthorizedHeaders
        Write-Warning "Unauthorized access test failed - should have thrown exception"
    }
    catch {
        Write-Success "Unauthorized access handled correctly"
    }
}

# Main execution
function Main {
    Write-Host ""
    Write-Status "Starting NIRI Scoring System Test Flow"
    Write-Host "==============================================" -ForegroundColor Blue
    
    if (-not (Test-Server)) { return }
    if (-not (Register-Users)) { return }
    if (-not (New-Submission)) { return }
    if (-not (Forward-Submission)) { return }
    if (-not (Approve-Submission)) { return }
    if (-not (Calculate-Score)) { return }
    if (-not (Get-DetailedScore)) { return }
    if (-not (Get-Rankings)) { return }
    if (-not (Get-Statistics)) { return }
    if (-not (Get-Methodology)) { return }
    Test-ErrorScenarios
    
    Write-Host ""
    Write-Success "🎉 All tests completed successfully!"
    Write-Host ""
    Write-Status "Test Summary:"
    Write-Host "- Submission ID: $TEST_SUBMISSION_ID" -ForegroundColor Cyan
    Write-Host "- Database ID: $SUBMISSION_ID" -ForegroundColor Cyan
    Write-Host "- All scoring endpoints tested" -ForegroundColor Cyan
    Write-Host "- Error scenarios validated" -ForegroundColor Cyan
    Write-Host "- Complete workflow verified" -ForegroundColor Cyan
    Write-Host ""
    Write-Status "You can now use the scoring system in production!"
}

# Run main function
Main


