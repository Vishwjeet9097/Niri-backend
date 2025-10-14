# Debug Scoring Script
Write-Host "=== Debug Scoring Calculation ===" -ForegroundColor Green

# Login as admin
$loginBody = @{
    email = "admin@example.com"
    password = "admin123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-WebRequest -Uri "http://localhost:3000/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    $loginData = $loginResponse.Content | ConvertFrom-Json
    $adminToken = $loginData.data.accessToken
    Write-Host "SUCCESS: Admin login successful" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Admin login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Get the latest submission
try {
    $headers = @{ Authorization = "Bearer $adminToken" }
    $submissionsResponse = Invoke-WebRequest -Uri "http://localhost:3000/submission" -Method GET -Headers $headers
    $submissions = $submissionsResponse.Content | ConvertFrom-Json
    $latestSubmission = $submissions | Sort-Object createdAt -Descending | Select-Object -First 1
    $submissionId = $latestSubmission.id
    Write-Host "Latest submission ID: $submissionId" -ForegroundColor Yellow
    
    # Show form data structure
    Write-Host "`n=== FORM DATA STRUCTURE ===" -ForegroundColor Cyan
    $formData = $latestSubmission.formData
    Write-Host "Infra Financing Keys: $($formData.infraFinancing.PSObject.Properties.Name -join ', ')" -ForegroundColor Yellow
    Write-Host "Section 1.1: $($formData.infraFinancing.section1_1 | ConvertTo-Json -Depth 2)" -ForegroundColor Yellow
    Write-Host "Section 1.2: $($formData.infraFinancing.section1_2 | ConvertTo-Json -Depth 2)" -ForegroundColor Yellow
    Write-Host "Section 1.3: $($formData.infraFinancing.section1_3 | ConvertTo-Json -Depth 2)" -ForegroundColor Yellow
    Write-Host "Section 1.4: $($formData.infraFinancing.section1_4 | ConvertTo-Json -Depth 2)" -ForegroundColor Yellow
    Write-Host "Section 1.5: $($formData.infraFinancing.section1_5 | ConvertTo-Json -Depth 2)" -ForegroundColor Yellow
    
} catch {
    Write-Host "ERROR: Failed to get submissions: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Calculate score
try {
    $scoreResponse = Invoke-WebRequest -Uri "http://localhost:3000/scoring/calculate/$submissionId" -Method GET -Headers $headers
    $scoreData = $scoreResponse.Content | ConvertFrom-Json
    Write-Host "`n=== SCORING RESULTS ===" -ForegroundColor Green
    Write-Host "Total Score: $($scoreData.totalScore)" -ForegroundColor Yellow
    Write-Host "Max Possible Score: $($scoreData.maxPossibleScore)" -ForegroundColor Yellow
    Write-Host "Percentage: $($scoreData.percentage)%" -ForegroundColor Yellow
    
    Write-Host "`n=== DETAILED BREAKDOWN ===" -ForegroundColor Cyan
    foreach ($calc in $scoreData.calculations) {
        $percentage = if ($calc.maxScore -gt 0) { [math]::Round(($calc.score / $calc.maxScore) * 100, 1) } else { 0 }
        Write-Host "$($calc.indicator): $($calc.score)/$($calc.maxScore) ($percentage%)" -ForegroundColor White
    }
    
} catch {
    Write-Host "ERROR: Score calculation failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== DEBUG COMPLETED ===" -ForegroundColor Green
