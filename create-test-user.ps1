# Create test user script for PowerShell
# This script will create a test user in the database

$BASE_URL = "http://localhost:3000"

# Register test admin user
$Body = @{
    email = "admin@niri.gov.in"
    password = "Admin@123"
    firstName = "Admin"
    lastName = "User"
    role = "MOSPI_APPROVER"
    stateUt = "Central"
} | ConvertTo-Json

Invoke-RestMethod -Uri "$BASE_URL/auth/register" -Method Post -ContentType "application/json" -Body $Body

Write-Host "Test admin user created"