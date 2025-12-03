/**
 * Fix States Code NULL Error
 * This script fixes the NULL code issue in the states table
 * Run: node fix-states-error.js
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Check if pg is installed
let Client;
try {
  const pg = require('pg');
  Client = pg.Client;
} catch (error) {
  console.error('ERROR: pg module not found. Installing...');
  console.error('Please run: npm install pg');
  process.exit(1);
}

// Database configuration
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'niri_db',
};

console.log('=== NIRI Backend - Fix States Code NULL Error ===\n');
console.log('Database Configuration:');
console.log(`  Host: ${config.host}`);
console.log(`  Port: ${config.port}`);
console.log(`  Database: ${config.database}`);
console.log(`  Username: ${config.user}\n`);

async function fixStatesTable() {
  const client = new Client(config);

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!\n');

    // Check for NULL codes
    console.log('Step 1: Checking for states with NULL codes...');
    const checkResult = await client.query(
      'SELECT COUNT(*) as count FROM states WHERE code IS NULL'
    );
    const nullCount = parseInt(checkResult.rows[0].count);
    console.log(`Found ${nullCount} states with NULL codes\n`);

    if (nullCount > 0) {
      console.log('Step 2: Displaying states with NULL codes...');
      const nullStates = await client.query(
        'SELECT id, name, code, type FROM states WHERE code IS NULL'
      );
      console.table(nullStates.rows);
      console.log();
    }

    // Update existing states with proper codes
    console.log('Step 3: Updating all Indian states with proper codes...');
    
    const stateMapping = {
      'Andhra Pradesh': { code: 'AP', type: 'ST' },
      'Arunachal Pradesh': { code: 'AR', type: 'ST' },
      'Assam': { code: 'AS', type: 'ST' },
      'Bihar': { code: 'BR', type: 'ST' },
      'Chhattisgarh': { code: 'CG', type: 'ST' },
      'Goa': { code: 'GA', type: 'ST' },
      'Gujarat': { code: 'GJ', type: 'ST' },
      'Haryana': { code: 'HR', type: 'ST' },
      'Himachal Pradesh': { code: 'HP', type: 'ST' },
      'Jharkhand': { code: 'JH', type: 'ST' },
      'Karnataka': { code: 'KA', type: 'ST' },
      'Kerala': { code: 'KL', type: 'ST' },
      'Madhya Pradesh': { code: 'MP', type: 'ST' },
      'Maharashtra': { code: 'MH', type: 'ST' },
      'Manipur': { code: 'MN', type: 'ST' },
      'Meghalaya': { code: 'ML', type: 'ST' },
      'Mizoram': { code: 'MZ', type: 'ST' },
      'Nagaland': { code: 'NL', type: 'ST' },
      'Odisha': { code: 'OR', type: 'ST' },
      'Punjab': { code: 'PB', type: 'ST' },
      'Rajasthan': { code: 'RJ', type: 'ST' },
      'Sikkim': { code: 'SK', type: 'ST' },
      'Tamil Nadu': { code: 'TN', type: 'ST' },
      'Telangana': { code: 'TG', type: 'ST' },
      'Tripura': { code: 'TR', type: 'ST' },
      'Uttar Pradesh': { code: 'UP', type: 'ST' },
      'Uttarakhand': { code: 'UK', type: 'ST' },
      'West Bengal': { code: 'WB', type: 'ST' },
      'Andaman and Nicobar Islands': { code: 'AN', type: 'UT' },
      'Chandigarh': { code: 'CH', type: 'UT' },
      'Dadra and Nagar Haveli and Daman and Diu': { code: 'DN', type: 'UT' },
      'Delhi': { code: 'DL', type: 'UT' },
      'Jammu and Kashmir': { code: 'JK', type: 'UT' },
      'Ladakh': { code: 'LA', type: 'UT' },
      'Lakshadweep': { code: 'LD', type: 'UT' },
      'Puducherry': { code: 'PY', type: 'UT' },
    };

    let updateCount = 0;
    for (const [name, data] of Object.entries(stateMapping)) {
      const result = await client.query(
        `UPDATE states SET code = $1, type = $2 WHERE name = $3 AND code IS NULL`,
        [data.code, data.type, name]
      );
      updateCount += result.rowCount;
    }
    console.log(`Updated ${updateCount} states with codes\n`);

    // Verify fix
    console.log('Step 4: Verifying fix...');
    const verifyResult = await client.query(
      'SELECT COUNT(*) as count FROM states WHERE code IS NULL'
    );
    const remainingNull = parseInt(verifyResult.rows[0].count);
    
    if (remainingNull === 0) {
      console.log('✓ SUCCESS: All states now have valid codes!\n');
      
      // Show all states
      const allStates = await client.query(
        'SELECT code, name, type FROM states ORDER BY code'
      );
      console.log('All states in database:');
      console.table(allStates.rows);
      
      console.log('\n✓ You can now run: npm run migration:run');
    } else {
      console.log(`✗ WARNING: Still ${remainingNull} states with NULL codes`);
      console.log('Please check the data manually');
    }

  } catch (error) {
    console.error('ERROR:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('\nDatabase connection refused. Please check:');
      console.error('1. PostgreSQL is running');
      console.error('2. Database credentials in .env are correct');
      console.error('3. Database host and port are accessible');
    }
    process.exit(1);
  } finally {
    await client.end();
    console.log('\nDatabase connection closed.');
  }
}

// Run the fix
fixStatesTable();
