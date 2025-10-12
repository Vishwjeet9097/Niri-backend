#!/bin/bash

# NIRI Backend - User Management Tests
echo "👥 Running User Management Tests..."

# Set test environment
export NODE_ENV=test
export DB_DATABASE=niri_test_db
export DB_USERNAME=postgres
export DB_PASSWORD=postgres123
export JWT_SECRET=test-jwt-secret-key-for-testing-only

# Run user management E2E tests
npm run test:e2e -- --testPathPattern=user.e2e-spec.ts
