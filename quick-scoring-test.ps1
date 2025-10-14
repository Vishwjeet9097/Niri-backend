# Quick NIRI Scoring Test Script
Write-Host "🚀 Quick NIRI Scoring Test" -ForegroundColor Green
Write-Host "=========================" -ForegroundColor Green

$BASE_URL = "http://localhost:3000"

# Test if server is running
Write-Host "Checking server..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$BASE_URL/health" -Method GET
    Write-Host "✅ Server is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Server is not running. Please start the server first." -ForegroundColor Red
    exit 1
}

# Test scoring methodology endpoint
Write-Host "`nTesting scoring methodology..." -ForegroundColor Yellow
try {
    $methodology = Invoke-RestMethod -Uri "$BASE_URL/scoring/methodology" -Method GET -Headers @{"Authorization" = "Bearer test-token"}
    Write-Host "✅ Methodology endpoint accessible" -ForegroundColor Green
    Write-Host "Version: $($methodology.data.version)" -ForegroundColor Cyan
    Write-Host "Total Marks: $($methodology.data.totalMarks)" -ForegroundColor Cyan
} catch {
    Write-Host "⚠️  Methodology endpoint requires authentication" -ForegroundColor Yellow
}

# Test form validation endpoint
Write-Host "`nTesting form validation..." -ForegroundColor Yellow
try {
    $validation = Invoke-RestMethod -Uri "$BASE_URL/scoring/validate-form-data" -Method POST -Headers @{"Authorization" = "Bearer test-token"} -Body '{"test": "data"}' -ContentType "application/json"
    Write-Host "✅ Form validation endpoint accessible" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Form validation endpoint requires authentication" -ForegroundColor Yellow
}

Write-Host "`n🎯 Quick test completed!" -ForegroundColor Green
Write-Host "For full testing, run: .\test-scoring-flow.ps1" -ForegroundColor Cyan




