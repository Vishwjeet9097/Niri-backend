const { Client } = require("pg");

async function checkTablesManually() {
  const client = new Client({
    host: "localhost",
    port: 5432,
    database: "niri_dev",
    user: "postgres",
    password: "postgres123",
  });

  try {
    await client.connect();
    console.log("✅ Connected to niri_dev database");

    // Check all tables
    const allTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    console.log("\n📋 All tables in niri_dev database:");
    allTables.rows.forEach((row) => {
      console.log(`   - ${row.table_name}`);
    });

    // Check if indicators table exists
    const indicatorsCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'indicators'
      );
    `);

    console.log(
      `\n🎯 Indicators table exists: ${indicatorsCheck.rows[0].exists}`
    );

    // Check if user_indicator_scope table exists
    const scopeCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_indicator_scope'
      );
    `);

    console.log(
      `👥 User indicator scope table exists: ${scopeCheck.rows[0].exists}`
    );

    // Check if states table exists
    const statesCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'states'
      );
    `);

    console.log(`🏛️ States table exists: ${statesCheck.rows[0].exists}`);

    // Check migrations table
    const migrations = await client.query(`
      SELECT name, timestamp 
      FROM migrations 
      ORDER BY timestamp DESC
    `);

    console.log("\n📝 Recent migrations:");
    migrations.rows.forEach((row) => {
      console.log(`   - ${row.name} (${row.timestamp})`);
    });
  } catch (error) {
    console.error("❌ Database check failed:", error.message);
  } finally {
    await client.end();
  }
}

checkTablesManually();
