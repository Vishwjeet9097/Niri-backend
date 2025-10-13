# NIRI Scoring System Test Script (Simple Version)
Write-Host "=== NIRI Scoring System Test ===" -ForegroundColor Green

# Step 1: Login and get JWT token
Write-Host "`n1. Logging in..." -ForegroundColor Yellow
$loginBody = @{
    email = "nodal@example.com"
    password = "nodal123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-WebRequest -Uri "http://localhost:3000/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    $loginData = $loginResponse.Content | ConvertFrom-Json
    
    if ($loginData.status -eq $true) {
        $token = $loginData.data.accessToken
        Write-Host "SUCCESS: Login successful" -ForegroundColor Green
        Write-Host "Token: $($token.Substring(0,20))..." -ForegroundColor Gray
    } else {
        Write-Host "ERROR: Login failed: $($loginData.message)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "ERROR: Login error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 2: Create a test submission with comprehensive dummy data
Write-Host "`n2. Creating test submission..." -ForegroundColor Yellow

$testFormData = @{
    # Infra Financing Data
    capexAllocation = 50000000000  # 50,000 crores
    gsdp = 2000000000000  # 20,00,000 crores (2.5% ratio)
    actualCapex = 45000000000  # 45,000 crores
    stateCapexUtilisation = 50000000000  # 50,000 crores (90% utilization)
    creditRatedULBs = 45
    totalULBs = 100  # 45% credit rated
    ulbsApprovedByMoSPI = 30
    totalULBsEntered = 100  # 30% issuing bonds
    hasFinancialIntermediary = "Yes"
    financialIntermediaryDocUploaded = $true
    
    # Infra Development Data
    infraActSectors = @(
        @{sector = "Transport"; docUploaded = $true},
        @{sector = "Water"; docUploaded = $true},
        @{sector = "Energy"; docUploaded = $true}
    )
    hasOverarchingAct = "Overarching"
    infraActDocUploaded = $true
    specializedEntitySectors = @(
        @{sector = "Transport"; docUploaded = $true},
        @{sector = "Water"; docUploaded = $true}
    )
    sectorPlanSectors = @(
        @{sector = "Transport"; docUploaded = $true},
        @{sector = "Water"; docUploaded = $true},
        @{sector = "Energy"; docUploaded = $true}
    )
    hasOverarchingPlan = "Overarching"
    sectorPlanDocUploaded = $true
    investmentProjects = @(
        @{name = "Highway Project 1"; docUploaded = $true},
        @{name = "Water Treatment Plant"; docUploaded = $true},
        @{name = "Solar Power Plant"; docUploaded = $true},
        @{name = "Metro Rail Project"; docUploaded = $true},
        @{name = "Airport Expansion"; docUploaded = $true}
    )
    assetMonetizationProjects = @(
        @{name = "Toll Road Asset"; docUploaded = $true},
        @{name = "Port Terminal"; docUploaded = $true},
        @{name = "Power Transmission Line"; docUploaded = $true},
        @{name = "Water Treatment Facility"; docUploaded = $true},
        @{name = "Railway Station"; docUploaded = $true}
    )
    
    # PPP Development Data
    hasPPPAct = "Yes"
    pppActDocUploaded = $true
    hasPPPCell = "Yes"
    pppCellDocUploaded = $true
    vgfProjects = @(
        @{name = "VGF Project 1"; docUploaded = $true},
        @{name = "VGF Project 2"; docUploaded = $true},
        @{name = "VGF Project 3"; docUploaded = $true},
        @{name = "VGF Project 4"; docUploaded = $true},
        @{name = "VGF Project 5"; docUploaded = $true},
        @{name = "VGF Project 6"; docUploaded = $true},
        @{name = "VGF Project 7"; docUploaded = $true},
        @{name = "VGF Project 8"; docUploaded = $true},
        @{name = "VGF Project 9"; docUploaded = $true},
        @{name = "VGF Project 10"; docUploaded = $true}
    )
    totalCostBankablePPP = 150000000000  # 15,000 crores
    totalCostAllInfraProjects = 200000000000  # 20,000 crores (75% PPP proportion)
    
    # Infra Enablers Data
    allProjectsOnNIP = "Yes"
    nipDocUploaded = $true
    hasStatePMG = "Yes"
    pmgDocOrURLUploaded = $true
    gatiShaktiProjects = @(
        @{name = "GatiShakti Project 1"; evidenceUploaded = $true},
        @{name = "GatiShakti Project 2"; evidenceUploaded = $true},
        @{name = "GatiShakti Project 3"; evidenceUploaded = $true},
        @{name = "GatiShakti Project 4"; evidenceUploaded = $true}
    )
    hasADR = "Yes"
    adrDocUploaded = $true
    innovativePractices = @(
        @{name = "Digital Payment System"; evidenceUploaded = $true},
        @{name = "Smart City Integration"; evidenceUploaded = $true},
        @{name = "Green Infrastructure"; evidenceUploaded = $true},
        @{name = "AI-based Monitoring"; evidenceUploaded = $true},
        @{name = "Blockchain for Transparency"; evidenceUploaded = $true}
    )
    capacityBuildingOfficers = @(
        @{name = "John Doe"; designation = "Chief Engineer"; participationDate = "2024-01-15"},
        @{name = "Jane Smith"; designation = "Project Manager"; participationDate = "2024-01-20"},
        @{name = "Mike Johnson"; designation = "Technical Director"; participationDate = "2024-02-01"},
        @{name = "Sarah Wilson"; designation = "Finance Officer"; participationDate = "2024-02-10"},
        @{name = "David Brown"; designation = "Planning Officer"; participationDate = "2024-02-15"},
        @{name = "Lisa Davis"; designation = "Quality Manager"; participationDate = "2024-02-20"},
        @{name = "Tom Miller"; designation = "Procurement Officer"; participationDate = "2024-03-01"},
        @{name = "Anna Garcia"; designation = "Environmental Officer"; participationDate = "2024-03-05"},
        @{name = "Chris Lee"; designation = "Legal Advisor"; participationDate = "2024-03-10"},
        @{name = "Emma Taylor"; designation = "Communication Officer"; participationDate = "2024-03-15"},
        @{name = "James Wilson"; designation = "IT Director"; participationDate = "2024-03-20"},
        @{name = "Maria Rodriguez"; designation = "HR Manager"; participationDate = "2024-03-25"},
        @{name = "Alex Thompson"; designation = "Operations Manager"; participationDate = "2024-03-30"},
        @{name = "Sophie Anderson"; designation = "Research Officer"; participationDate = "2024-04-01"},
        @{name = "Ryan Clark"; designation = "Safety Officer"; participationDate = "2024-04-05"},
        @{name = "Olivia White"; designation = "Budget Officer"; participationDate = "2024-04-10"},
        @{name = "Daniel Harris"; designation = "Contract Manager"; participationDate = "2024-04-15"},
        @{name = "Grace Martin"; designation = "Policy Advisor"; participationDate = "2024-04-20"},
        @{name = "Noah Jackson"; designation = "Technical Specialist"; participationDate = "2024-04-25"},
        @{name = "Ava Thompson"; designation = "Coordination Officer"; participationDate = "2024-04-30"},
        @{name = "Liam Davis"; designation = "Implementation Manager"; participationDate = "2024-05-01"},
        @{name = "Mia Wilson"; designation = "Evaluation Officer"; participationDate = "2024-05-05"},
        @{name = "Lucas Brown"; designation = "Innovation Manager"; participationDate = "2024-05-10"},
        @{name = "Isabella Garcia"; designation = "Partnership Officer"; participationDate = "2024-05-15"},
        @{name = "Mason Miller"; designation = "Development Officer"; participationDate = "2024-05-20"},
        @{name = "Sophia Lee"; designation = "Strategic Planner"; participationDate = "2024-05-25"},
        @{name = "Ethan Taylor"; designation = "Resource Manager"; participationDate = "2024-05-30"},
        @{name = "Charlotte Anderson"; designation = "Quality Assurance"; participationDate = "2024-06-01"},
        @{name = "Logan Clark"; designation = "Performance Analyst"; participationDate = "2024-06-05"},
        @{name = "Amelia White"; designation = "Stakeholder Manager"; participationDate = "2024-06-10"},
        @{name = "Benjamin Harris"; designation = "Technology Officer"; participationDate = "2024-06-15"},
        @{name = "Harper Martin"; designation = "Compliance Officer"; participationDate = "2024-06-20"},
        @{name = "William Jackson"; designation = "Integration Manager"; participationDate = "2024-06-25"},
        @{name = "Evelyn Thompson"; designation = "Monitoring Officer"; participationDate = "2024-06-30"},
        @{name = "James Davis"; designation = "Coordination Specialist"; participationDate = "2024-07-01"},
        @{name = "Abigail Wilson"; designation = "Implementation Specialist"; participationDate = "2024-07-05"},
        @{name = "Alexander Brown"; designation = "Evaluation Specialist"; participationDate = "2024-07-10"},
        @{name = "Emily Garcia"; designation = "Innovation Specialist"; participationDate = "2024-07-15"},
        @{name = "Michael Miller"; designation = "Partnership Specialist"; participationDate = "2024-07-20"},
        @{name = "Elizabeth Lee"; designation = "Development Specialist"; participationDate = "2024-07-25"},
        @{name = "Daniel Taylor"; designation = "Strategic Specialist"; participationDate = "2024-07-30"},
        @{name = "Sofia Anderson"; designation = "Resource Specialist"; participationDate = "2024-08-01"},
        @{name = "Matthew Clark"; designation = "Quality Specialist"; participationDate = "2024-08-05"},
        @{name = "Avery White"; designation = "Performance Specialist"; participationDate = "2024-08-10"},
        @{name = "Jackson Harris"; designation = "Stakeholder Specialist"; participationDate = "2024-08-15"},
        @{name = "Ella Martin"; designation = "Technology Specialist"; participationDate = "2024-08-20"},
        @{name = "Sebastian Jackson"; designation = "Compliance Specialist"; participationDate = "2024-08-25"},
        @{name = "Madison Thompson"; designation = "Integration Specialist"; participationDate = "2024-08-30"},
        @{name = "Jack Davis"; designation = "Monitoring Specialist"; participationDate = "2024-09-01"},
        @{name = "Scarlett Wilson"; designation = "Coordination Expert"; participationDate = "2024-09-05"},
        @{name = "Owen Brown"; designation = "Implementation Expert"; participationDate = "2024-09-10"},
        @{name = "Victoria Garcia"; designation = "Evaluation Expert"; participationDate = "2024-09-15"},
        @{name = "Connor Miller"; designation = "Innovation Expert"; participationDate = "2024-09-20"},
        @{name = "Grace Lee"; designation = "Partnership Expert"; participationDate = "2024-09-25"},
        @{name = "Caleb Taylor"; designation = "Development Expert"; participationDate = "2024-09-30"},
        @{name = "Chloe Anderson"; designation = "Strategic Expert"; participationDate = "2024-10-01"},
        @{name = "Ryan Clark"; designation = "Resource Expert"; participationDate = "2024-10-05"},
        @{name = "Zoey White"; designation = "Quality Expert"; participationDate = "2024-10-10"},
        @{name = "Nathan Harris"; designation = "Performance Expert"; participationDate = "2024-10-15"}
    )
}

$submissionBody = @{
    submissionId = "TEST-SUB-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    formData = $testFormData
}

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

try {
    $submissionResponse = Invoke-WebRequest -Uri "http://localhost:3000/submission" -Method POST -Body ($submissionBody | ConvertTo-Json -Depth 10) -Headers $headers
    $submissionData = $submissionResponse.Content | ConvertFrom-Json
    
    if ($submissionData.status -eq $true) {
        $submissionId = $submissionData.data.id
        Write-Host "SUCCESS: Test submission created successfully" -ForegroundColor Green
        Write-Host "Submission ID: $submissionId" -ForegroundColor Gray
    } else {
        Write-Host "ERROR: Submission creation failed: $($submissionData.message)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "ERROR: Submission creation error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Response: $($_.Exception.Response)" -ForegroundColor Red
    exit 1
}

# Step 3: Submit to state first
Write-Host "`n3. Submitting to state..." -ForegroundColor Yellow

try {
    $submitResponse = Invoke-WebRequest -Uri "http://localhost:3000/submission/submit-to-state/$submissionId" -Method POST -Headers $headers
    $submitData = $submitResponse.Content | ConvertFrom-Json
    
    if ($submitData.status -eq $true) {
        Write-Host "SUCCESS: Submission submitted to state successfully" -ForegroundColor Green
    } else {
        Write-Host "ERROR: Submission to state failed: $($submitData.message)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "ERROR: Submission to state error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 4: Login as state approver to forward
Write-Host "`n4. Logging in as state approver..." -ForegroundColor Yellow

$stateLoginBody = @{
    email = "state@example.com"
    password = "state123"
} | ConvertTo-Json

try {
    $stateLoginResponse = Invoke-WebRequest -Uri "http://localhost:3000/auth/login" -Method POST -Body $stateLoginBody -ContentType "application/json"
    $stateLoginData = $stateLoginResponse.Content | ConvertFrom-Json
    
    if ($stateLoginData.status -eq $true) {
        $stateToken = $stateLoginData.data.accessToken
        Write-Host "SUCCESS: State approver login successful" -ForegroundColor Green
    } else {
        Write-Host "ERROR: State approver login failed: $($stateLoginData.message)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "ERROR: State approver login error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 5: Forward to MoSPI
Write-Host "`n5. Forwarding to MoSPI..." -ForegroundColor Yellow

$stateHeaders = @{
    "Authorization" = "Bearer $stateToken"
    "Content-Type" = "application/json"
}

$forwardBody = @{
    comment = "Forwarded to MoSPI for review"
}

try {
    $forwardResponse = Invoke-WebRequest -Uri "http://localhost:3000/submission/forward-to-mospi/$submissionId" -Method POST -Body ($forwardBody | ConvertTo-Json) -Headers $stateHeaders
    $forwardData = $forwardResponse.Content | ConvertFrom-Json
    
    if ($forwardData.status -eq $true) {
        Write-Host "SUCCESS: Submission forwarded to MoSPI successfully" -ForegroundColor Green
    } else {
        Write-Host "ERROR: Forward to MoSPI failed: $($forwardData.message)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "ERROR: Forward to MoSPI error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 6: Login as MoSPI Reviewer to forward to approver
Write-Host "`n6. Logging in as MoSPI Reviewer..." -ForegroundColor Yellow

$reviewerLoginBody = @{
    email = "reviewer@example.com"
    password = "reviewer123"
} | ConvertTo-Json

try {
    $reviewerLoginResponse = Invoke-WebRequest -Uri "http://localhost:3000/auth/login" -Method POST -Body $reviewerLoginBody -ContentType "application/json"
    $reviewerLoginData = $reviewerLoginResponse.Content | ConvertFrom-Json
    
    if ($reviewerLoginData.status -eq $true) {
        $reviewerToken = $reviewerLoginData.data.accessToken
        Write-Host "SUCCESS: MoSPI Reviewer login successful" -ForegroundColor Green
    } else {
        Write-Host "ERROR: MoSPI Reviewer login failed: $($reviewerLoginData.message)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "ERROR: MoSPI Reviewer login error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 7: Forward to MoSPI Approver
Write-Host "`n7. Forwarding to MoSPI Approver..." -ForegroundColor Yellow

$reviewerHeaders = @{
    "Authorization" = "Bearer $reviewerToken"
    "Content-Type" = "application/json"
}

$forwardToApproverBody = @{
    status = "SUBMITTED_TO_MOSPI_APPROVER"
    comment = "Reviewed and approved, forwarding to MoSPI Approver for final approval"
}

try {
    $forwardToApproverResponse = Invoke-WebRequest -Uri "http://localhost:3000/submission/forward-to-mospi-approver/$submissionId" -Method POST -Body ($forwardToApproverBody | ConvertTo-Json) -Headers $reviewerHeaders
    $forwardToApproverData = $forwardToApproverResponse.Content | ConvertFrom-Json
    
    if ($forwardToApproverData.status -eq $true) {
        Write-Host "SUCCESS: Submission forwarded to MoSPI Approver successfully" -ForegroundColor Green
    } else {
        Write-Host "ERROR: Forward to MoSPI Approver failed: $($forwardToApproverData.message)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "ERROR: Forward to MoSPI Approver error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 8: Login as admin to approve
Write-Host "`n8. Logging in as admin..." -ForegroundColor Yellow

$adminLoginBody = @{
    email = "admin@example.com"
    password = "admin123"
} | ConvertTo-Json

try {
    $adminLoginResponse = Invoke-WebRequest -Uri "http://localhost:3000/auth/login" -Method POST -Body $adminLoginBody -ContentType "application/json"
    $adminLoginData = $adminLoginResponse.Content | ConvertFrom-Json
    
    if ($adminLoginData.status -eq $true) {
        $adminToken = $adminLoginData.data.accessToken
        Write-Host "SUCCESS: Admin login successful" -ForegroundColor Green
    } else {
        Write-Host "ERROR: Admin login failed: $($adminLoginData.message)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "ERROR: Admin login error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 9: Approve the submission
Write-Host "`n9. Approving submission..." -ForegroundColor Yellow

$adminHeaders = @{
    "Authorization" = "Bearer $adminToken"
    "Content-Type" = "application/json"
}

$approveBody = @{
    status = "APPROVED"
    comment = "Approved by MoSPI Approver"
}

try {
    $approveResponse = Invoke-WebRequest -Uri "http://localhost:3000/submission/approve/$submissionId" -Method POST -Body ($approveBody | ConvertTo-Json) -Headers $adminHeaders
    $approveData = $approveResponse.Content | ConvertFrom-Json
    
    if ($approveData.status -eq $true) {
        Write-Host "SUCCESS: Submission approved successfully" -ForegroundColor Green
    } else {
        Write-Host "ERROR: Submission approval failed: $($approveData.message)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "ERROR: Submission approval error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 10: Calculate score
Write-Host "`n10. Calculating score..." -ForegroundColor Yellow

try {
    $scoreResponse = Invoke-WebRequest -Uri "http://localhost:3000/scoring/calculate/$submissionId" -Method GET -Headers $adminHeaders
    $scoreData = $scoreResponse.Content | ConvertFrom-Json
    
    if ($scoreData.status -eq $true) {
        Write-Host "SUCCESS: Score calculated successfully!" -ForegroundColor Green
        Write-Host "`n=== SCORING RESULTS ===" -ForegroundColor Cyan
        Write-Host "Total Score: $($scoreData.data.totalScore)" -ForegroundColor White
        Write-Host "Max Possible Score: $($scoreData.data.maxPossibleScore)" -ForegroundColor White
        Write-Host "Percentage: $($scoreData.data.percentage)%" -ForegroundColor White
        Write-Host "Methodology: $($scoreData.data.calculationMethodology)" -ForegroundColor Gray
        
        Write-Host "`n=== DETAILED BREAKDOWN ===" -ForegroundColor Cyan
        $scoreData.data.scoreBreakdown.calculations | ForEach-Object {
            $indicator = $_.indicator
            $score = $_.score
            $maxScore = $_.maxScore
            $percentage = [math]::Round(($score / $maxScore) * 100, 2)
            $color = if ($percentage -ge 80) { "Green" } elseif ($percentage -ge 60) { "Yellow" } else { "Red" }
            Write-Host "$indicator`: $score/$maxScore ($percentage%)" -ForegroundColor $color
        }
        
        # Calculate category totals
        Write-Host "`n=== CATEGORY TOTALS ===" -ForegroundColor Cyan
        $infraFinancing = ($scoreData.data.scoreBreakdown.calculations | Where-Object { $_.indicator -like "1.*" } | Measure-Object -Property score -Sum).Sum
        $infraDevelopment = ($scoreData.data.scoreBreakdown.calculations | Where-Object { $_.indicator -like "2.*" } | Measure-Object -Property score -Sum).Sum
        $pppDevelopment = ($scoreData.data.scoreBreakdown.calculations | Where-Object { $_.indicator -like "3.*" } | Measure-Object -Property score -Sum).Sum
        $infraEnablers = ($scoreData.data.scoreBreakdown.calculations | Where-Object { $_.indicator -like "4.*" } | Measure-Object -Property score -Sum).Sum
        
        Write-Host "1. Infra Financing: $infraFinancing/250" -ForegroundColor White
        Write-Host "2. Infra Development: $infraDevelopment/250" -ForegroundColor White
        Write-Host "3. PPP Development: $pppDevelopment/250" -ForegroundColor White
        Write-Host "4. Infra Enablers: $infraEnablers/250" -ForegroundColor White
        
    } else {
        Write-Host "ERROR: Score calculation failed: $($scoreData.message)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "ERROR: Score calculation error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Response: $($_.Exception.Response)" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== TEST COMPLETED ===" -ForegroundColor Green
Write-Host "All scoring functionality has been tested successfully!" -ForegroundColor Green
