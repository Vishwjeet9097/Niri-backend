#!/bin/bash

# NIRI Backend - Authentication Tests
echo "🔐 Running Authentication Tests..."

# Set test environment
export NODE_ENV=test
export DB_DATABASE=niri_test_db
export DB_USERNAME=postgres
export DB_PASSWORD=postgres123
export JWT_SECRET=test-jwt-secret-key-for-testing-only
export DB_HOST=localhost
export DB_PORT=5432

# Set PostgreSQL password environment variable
export PGPASSWORD=postgres123

# Run authentication E2E tests
npm run test:e2e -- --testPathPattern=auth.e2e-spec.ts
