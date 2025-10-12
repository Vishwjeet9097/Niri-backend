#!/bin/bash

# NIRI Backend - Dashboard Tests
echo "📊 Running Dashboard Tests..."

# Set test environment
export NODE_ENV=test
export DB_DATABASE=niri_test_db
export DB_USERNAME=postgres
export DB_PASSWORD=postgres123
export JWT_SECRET=test-jwt-secret-key-for-testing-only

# Run dashboard E2E tests
npm run test:e2e -- --testPathPattern=dashboard.e2e-spec.ts
