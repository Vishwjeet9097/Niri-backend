// Jest E2E setup file
import { execSync } from 'child_process';

// Setup test database
beforeAll(async () => {
  try {
    // Create test database if it doesn't exist
    execSync('createdb niri_test_db || true', { stdio: 'ignore' });
  } catch (error) {
    console.warn('Could not create test database:', error.message);
  }
});

afterAll(async () => {
  try {
    // Drop test database
    execSync('dropdb niri_test_db || true', { stdio: 'ignore' });
  } catch (error) {
    console.warn('Could not drop test database:', error.message);
  }
});
