#!/bin/bash

# Create test user script
# This script will create a test user in the database

BASE_URL="http://localhost:3000"

# Register test admin user
curl -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@niri.gov.in",
    "password": "Admin@123",
    "firstName": "Admin",
    "lastName": "User",
    "role": "MOSPI_APPROVER",
    "stateUt": "Central"
  }'

echo "Test admin user created"