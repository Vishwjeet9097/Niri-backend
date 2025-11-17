# =====================================================
# Quick Fix Script for States Code NULL Error
# =====================================================
# This PowerShell script helps you fix the NULL code issue
# Date: 2025-11-13
# =====================================================

Write-Host "=== NIRI Backend - Fix States Code NULL Error ===" -ForegroundColor Cyan
Write-Host ""

# Load environment variables from .env file
if (Test-Path ".env") {
    Write-Host "Loading database configuration from .env..." -ForegroundColor Yellow
    Get-Content .env | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            Set-Item -Path "env:$key" -Value $value
        }
    }
} else {
    Write-Host "WARNING: .env file not found. Using default values." -ForegroundColor Red
    $env:DB_HOST = "localhost"
    $env:DB_PORT = "5432"
    $env:DB_USERNAME = "postgres"
    $env:DB_PASSWORD = "postgres"
    $env:DB_DATABASE = "niri_db"
}

Write-Host ""
Write-Host "Database Configuration:" -ForegroundColor Green
Write-Host "  Host: $env:DB_HOST"
Write-Host "  Port: $env:DB_PORT"
Write-Host "  Database: $env:DB_DATABASE"
Write-Host "  Username: $env:DB_USERNAME"
Write-Host ""

# Check if psql is available
$psqlExists = Get-Command psql -ErrorAction SilentlyContinue
$dockerExists = Get-Command docker -ErrorAction SilentlyContinue

if ($psqlExists) {
    Write-Host "Method: Using PostgreSQL CLI (psql)" -ForegroundColor Green
    Write-Host ""
    Write-Host "Running SQL fix script..." -ForegroundColor Yellow
    
    $env:PGPASSWORD = $env:DB_PASSWORD
    psql -h $env:DB_HOST -p $env:DB_PORT -U $env:DB_USERNAME -d $env:DB_DATABASE -f "fix_states_add_all_indian_states.sql"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "SUCCESS: States table has been fixed!" -ForegroundColor Green
        Write-Host "You can now run: npm run migration:run" -ForegroundColor Cyan
    } else {
        Write-Host ""
        Write-Host "ERROR: Failed to execute SQL script." -ForegroundColor Red
    }
}
elseif ($dockerExists) {
    Write-Host "Method: Using Docker" -ForegroundColor Green
    Write-Host ""
    
    # Find PostgreSQL container
    $containers = docker ps --format "{{.Names}}" | Select-String -Pattern "postgres"
    
    if ($containers) {
        $containerName = $containers[0]
        Write-Host "Found PostgreSQL container: $containerName" -ForegroundColor Yellow
        Write-Host "Running SQL fix script..." -ForegroundColor Yellow
        
        Get-Content "fix_states_add_all_indian_states.sql" | docker exec -i $containerName psql -U $env:DB_USERNAME -d $env:DB_DATABASE
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "SUCCESS: States table has been fixed!" -ForegroundColor Green
            Write-Host "You can now run: npm run migration:run" -ForegroundColor Cyan
        } else {
            Write-Host ""
            Write-Host "ERROR: Failed to execute SQL script." -ForegroundColor Red
        }
    } else {
        Write-Host "ERROR: No PostgreSQL Docker container found running." -ForegroundColor Red
        Write-Host "Please start your Docker containers first with: docker-compose up -d" -ForegroundColor Yellow
    }
}
else {
    Write-Host "ERROR: Neither psql nor docker commands are available." -ForegroundColor Red
    Write-Host ""
    Write-Host "Please choose one of these options:" -ForegroundColor Yellow
    Write-Host "1. Install PostgreSQL client tools (includes psql)"
    Write-Host "2. Use Docker and run: docker-compose up -d"
    Write-Host "3. Manually connect to your database and run: fix_states_add_all_indian_states.sql"
    Write-Host "4. Use a database GUI tool (pgAdmin, DBeaver, etc.) to run the SQL script"
}

Write-Host ""
Write-Host "=== Script Complete ===" -ForegroundColor Cyan
