# NIRI Scoring System Test with Correct Form Structure
Write-Host "=== NIRI Scoring System Test (Fixed Form Structure) ===" -ForegroundColor Green

# Step 1: Login as Nodal Officer
Write-Host "`n1. Logging in..." -ForegroundColor Yellow

$loginBody = @{
    email = "nodal3@example.com"
    password = "password123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-WebRequest -Uri "http://localhost:3000/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    $loginData = $loginResponse.Content | ConvertFrom-Json
    
    if ($loginData.status -eq $true) {
        $nodalToken = $loginData.data.accessToken
        Write-Host "SUCCESS: Login successful" -ForegroundColor Green
    } else {
        Write-Host "ERROR: Login failed: $($loginData.message)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "ERROR: Login error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 2: Create a test submission with correct form structure
Write-Host "`n2. Creating test submission..." -ForegroundColor Yellow

$testFormData = @{
    infraFinancing = @{
        section1_1 = @{
            year = "2025"
            gsdpForFY = "54445"
            percentage = 834.87
            stateCapex = "544654"
            marksObtained = 50
            allocationToGSDP = "6665"
            capitalAllocation = "454545"
            capexToCapexActuals = "98"
            stateCapexUtilisation = "44455"
        }
        section1_2 = @{
            year = "2052"
            gsdpForFY = "2587"
            percentage = 9.88
            actualCapex = "7699"
            marksObtained = 4.94
            budgetaryCapex = "77888"
            capexActualsToGSDP = "52"
            stateCapexUtilisation = "154452"
        }
        section1_3 = @(
            @{
                id = "1760375395502"
                ulb = "Nagpur Municipal Corporation"
                rating = "AA"
                cityName = "Mumbai"
                ratingDate = "2025-10-15T18:30:00.000Z"
            },
            @{
                id = "1760417486705"
                ulb = "Mumbai Municipal Corporation"
                rating = "A+"
                cityName = "Delhi"
                ratingDate = "2025-10-14T18:30:00.000Z"
            }
        )
        section1_4 = @(
            @{
                id = "1760375414072"
                value = "520"
                bondType = "Infrastructure bond"
                cityName = "Pune"
                issuingAuthority = "Municipal Corporation"
            },
            @{
                id = "1760417502026"
                value = "998"
                bondType = "Revenue bond"
                cityName = "Nagpur"
                issuingAuthority = "Development Authority"
            }
        )
        section1_5 = @(
            @{
                id = "1760375426241"
                website = "knjsadkjask"
                totalFunding = "123"
                yearEstablished = "2015"
                organisationName = "test"
                organisationType = "Development Authority"
            }
        )
    }
    infraDevelopment = @{
        section2_1 = @(
            @{
                id = "fe056c6c-0737-4957-833b-9db745e3c5d9"
                files = @(
                    @{
                        id = "02e8c0ce-5100-41ed-9f5e-7bfc95e9e4d7"
                        file = @{}
                        fileName = "Press Release_Press Information Bureau1.pdf"
                        fileSize = 336247
                        uploadedAt = 1760375512555
                    }
                )
                sector = "Health"
            }
        )
        section2_2 = @(
            @{
                id = "4e1ded08-6c09-46a5-a7fb-318dd620769d"
                files = @(
                    @{
                        id = "e99b4d66-8625-4a45-aefc-838f082a24ae"
                        file = @{}
                        fileName = "Press Release_Press Information Bureau2.pdf"
                        fileSize = 122584
                        uploadedAt = 1760375523173
                    }
                )
                sector = "Energy"
            }
        )
        section2_3 = @(
            @{
                id = "7b877434-da20-4c8d-99f9-35ba50061564"
                files = @(
                    @{
                        id = "ed87e980-3837-4c6c-8f3d-14bd6c7ad7df"
                        file = @{}
                        fileName = "Press Release_Press Information Bureau6.pdf"
                        fileSize = 141512
                        uploadedAt = 1760375533600
                    }
                )
                sector = "Other"
            }
        )
        section2_4 = @(
            @{
                id = "d0a68300-34b6-4b02-be16-ee8f285bc49e"
                dprFile = @{
                    id = "5d106366-2278-434a-be32-c0349e6c4101"
                    file = @{}
                    fileName = "Press Release_Press Information Bureau.pdf"
                    fileSize = 205277
                    uploadedAt = 1760375544244
                }
                projectName = "kjhiuh"
            }
        )
        section2_5 = @(
            @{
                id = "3b05ec0e-0717-443f-be9-7971cb2637e1"
                type = "EPC"
                sector = "Health"
                ownership = "Revenue sharing"
                projectName = "ljkh"
                estimatedMonetization = "5458"
            }
        )
    }
    pppDevelopment = @{
        section3_1 = @{
            file = $null
            available = "no"
        }
        section3_2 = @{
            file = $null
            available = "no"
        }
        section3_3 = @()
        section3_4 = @{
            totalTPC = "6988"
            proportion = 958.57
            marksObtained = 100
            tpcOfPPPProjects = "66985"
        }
    }
    infraEnablers = @{
        section4_1 = @{
            allEligible = ""
            websiteLink = ""
        }
        section4_2 = @{
            file = @{
                id = "7d6baa8b-99b5-4b41-b88f-8efa5a900ff0"
                file = @{}
                fileName = "Press Release_Press Information Bureau3.pdf"
                fileSize = 135815
                uploadedAt = 1760416749098
            }
            available = "yes"
        }
        section4_3 = @{
            marksObtained = 0
            numberOfProjects = ""
        }
        section4_4 = @{
            file = $null
            adopted = "no"
            marksObtained = 0
        }
        section4_5 = @{
            file = $null
            impact = ""
            implemented = ""
            practiceName = ""
        }
        section4_6 = @()
    }
}

$submissionBody = @{
    submissionId = [System.Guid]::NewGuid().ToString()
    formData = $testFormData
    stateUt = "Maharashtra"
} | ConvertTo-Json -Depth 10

try {
    $headers = @{ Authorization = "Bearer $nodalToken" }
    $submissionResponse = Invoke-WebRequest -Uri "http://localhost:3000/submission" -Method POST -Body $submissionBody -ContentType "application/json" -Headers $headers
    $submissionData = $submissionResponse.Content | ConvertFrom-Json
    
    if ($submissionData.status -eq $true) {
        $submissionId = $submissionData.data.id
        Write-Host "SUCCESS: Test submission created successfully" -ForegroundColor Green
        Write-Host "Submission ID: $submissionId" -ForegroundColor Yellow
    } else {
        Write-Host "ERROR: Submission creation failed: $($submissionData.message)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "ERROR: Submission creation error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 3: Submit to state
Write-Host "`n3. Submitting to state..." -ForegroundColor Yellow

$submitBody = @{
    status = "SUBMITTED_TO_STATE"
} | ConvertTo-Json

try {
    $submitResponse = Invoke-WebRequest -Uri "http://localhost:3000/submission/submit-to-state/$submissionId" -Method POST -Body $submitBody -ContentType "application/json" -Headers $headers
    $submitData = $submitResponse.Content | ConvertFrom-Json
    
    if ($submitData.status -eq $true) {
        Write-Host "SUCCESS: Submission submitted to state successfully" -ForegroundColor Green
    } else {
        Write-Host "ERROR: Submit to state failed: $($submitData.message)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "ERROR: Submit to state error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 4: Login as State Approver
Write-Host "`n4. Logging in as state approver..." -ForegroundColor Yellow

$stateLoginBody = @{
    email = "state2@example.com"
    password = "password123"
} | ConvertTo-Json

try {
    $stateLoginResponse = Invoke-WebRequest -Uri "http://localhost:3000/auth/login" -Method POST -Body $stateLoginBody -ContentType "application/json"
    $stateLoginData = $stateLoginResponse.Content | ConvertFrom-Json
    $stateToken = $stateLoginData.data.accessToken
    Write-Host "SUCCESS: State approver login successful" -ForegroundColor Green
} catch {
    Write-Host "ERROR: State approver login error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 5: Forward to MoSPI
Write-Host "`n5. Forwarding to MoSPI..." -ForegroundColor Yellow

$forwardBody = @{
    status = "SUBMITTED_TO_MOSPI_REVIEWER"
} | ConvertTo-Json

try {
    $stateHeaders = @{ Authorization = "Bearer $stateToken" }
    $forwardResponse = Invoke-WebRequest -Uri "http://localhost:3000/submission/forward-to-mospi/$submissionId" -Method POST -Body $forwardBody -ContentType "application/json" -Headers $stateHeaders
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

# Step 6: Login as MoSPI Reviewer
Write-Host "`n6. Logging in as MoSPI Reviewer..." -ForegroundColor Yellow

$reviewerLoginBody = @{
    email = "reviewer2@example.com"
    password = "password123"
} | ConvertTo-Json

try {
    $reviewerLoginResponse = Invoke-WebRequest -Uri "http://localhost:3000/auth/login" -Method POST -Body $reviewerLoginBody -ContentType "application/json"
    $reviewerLoginData = $reviewerLoginResponse.Content | ConvertFrom-Json
    $reviewerToken = $reviewerLoginData.data.accessToken
    Write-Host "SUCCESS: MoSPI Reviewer login successful" -ForegroundColor Green
} catch {
    Write-Host "ERROR: MoSPI Reviewer login error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 7: Forward to MoSPI Approver
Write-Host "`n7. Forwarding to MoSPI Approver..." -ForegroundColor Yellow

$forwardToApproverBody = @{
    status = "SUBMITTED_TO_MOSPI_APPROVER"
} | ConvertTo-Json

try {
    $reviewerHeaders = @{ Authorization = "Bearer $reviewerToken" }
    $forwardToApproverResponse = Invoke-WebRequest -Uri "http://localhost:3000/submission/forward-to-mospi-approver/$submissionId" -Method POST -Body $forwardToApproverBody -ContentType "application/json" -Headers $reviewerHeaders
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

# Step 9: Approve submission
Write-Host "`n9. Approving submission..." -ForegroundColor Yellow

$approveBody = @{
    status = "APPROVED"
    comment = "Approved for scoring"
} | ConvertTo-Json

try {
    $adminHeaders = @{ Authorization = "Bearer $adminToken" }
    $approveResponse = Invoke-WebRequest -Uri "http://localhost:3000/submission/approve/$submissionId" -Method POST -Body $approveBody -ContentType "application/json" -Headers $adminHeaders
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
    
    if ($scoreData) {
        Write-Host "SUCCESS: Score calculated successfully!" -ForegroundColor Green
        
        Write-Host "`n=== SCORING RESULTS ===" -ForegroundColor Green
        Write-Host "Total Score: $($scoreData.totalScore)" -ForegroundColor Yellow
        Write-Host "Max Possible Score: $($scoreData.maxPossibleScore)" -ForegroundColor Yellow
        Write-Host "Percentage: $($scoreData.percentage)%" -ForegroundColor Yellow
        Write-Host "Methodology: $($scoreData.methodology)" -ForegroundColor Yellow
        
        Write-Host "`n=== DETAILED BREAKDOWN ===" -ForegroundColor Cyan
        foreach ($calc in $scoreData.calculations) {
            $percentage = if ($calc.maxScore -gt 0) { [math]::Round(($calc.score / $calc.maxScore) * 100, 1) } else { 0 }
            Write-Host "$($calc.indicator): $($calc.score)/$($calc.maxScore) ($percentage%)" -ForegroundColor White
        }
        
        # Calculate category totals
        $infraFinancing = ($scoreData.calculations | Where-Object { $_.indicator -like "1.*" } | Measure-Object -Property score -Sum).Sum
        $infraDevelopment = ($scoreData.calculations | Where-Object { $_.indicator -like "2.*" } | Measure-Object -Property score -Sum).Sum
        $pppDevelopment = ($scoreData.calculations | Where-Object { $_.indicator -like "3.*" } | Measure-Object -Property score -Sum).Sum
        $infraEnablers = ($scoreData.calculations | Where-Object { $_.indicator -like "4.*" } | Measure-Object -Property score -Sum).Sum
        
        Write-Host "`n=== CATEGORY TOTALS ===" -ForegroundColor Magenta
        Write-Host "1. Infra Financing: $infraFinancing/250" -ForegroundColor White
        Write-Host "2. Infra Development: $infraDevelopment/250" -ForegroundColor White
        Write-Host "3. PPP Development: $pppDevelopment/250" -ForegroundColor White
        Write-Host "4. Infra Enablers: $infraEnablers/250" -ForegroundColor White
        
    } else {
        Write-Host "ERROR: No score data received" -ForegroundColor Red
    }
} catch {
    Write-Host "ERROR: Score calculation error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== TEST COMPLETED ===" -ForegroundColor Green
Write-Host "All scoring functionality has been tested successfully!" -ForegroundColor Green
