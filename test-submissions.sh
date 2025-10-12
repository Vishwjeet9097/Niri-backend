#!/bin/bash

# NIRI Backend - Submission Tests
echo "📝 Running Submission Workflow Tests..."

# Set test environment
export NODE_ENV=test
export DB_DATABASE=niri_test_db
export DB_USERNAME=postgres
export DB_PASSWORD=postgres123
export JWT_SECRET=test-jwt-secret-key-for-testing-only

# Run submission E2E tests
npm run test:e2e -- --testPathPattern=submission.e2e-spec.ts
