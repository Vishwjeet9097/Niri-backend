const { Client } = require("pg");

async function checkIndicatorsDatabase() {
  const client = new Client({
    host: "localhost",
    port: 5432,
    database: "niri_dev",
    user: "postgres",
    password: "postgres123", // Try common postgres password
  });

  try {
    await client.connect();
    console.log("✅ Connected to niri_dev database");

    // Check if indicators table exists
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('indicators', 'user_indicator_scope', 'states')
      ORDER BY table_name
    `);

    console.log("\n📊 Tables found in niri_dev:");
    tableCheck.rows.forEach((row) => {
      console.log(`   ✅ ${row.table_name}`);
    });

    // Check indicators data
    if (tableCheck.rows.some((row) => row.table_name === "indicators")) {
      const indicators = await client.query(
        "SELECT code, indicator_name, category, max_score FROM indicators ORDER BY code"
      );
      console.log("\n🎯 Indicators in database:");
      indicators.rows.forEach((row) => {
        console.log(
          `   ${row.code} - ${row.indicator_name} (${row.max_score} marks)`
        );
      });
      console.log(`\n📈 Total indicators: ${indicators.rows.length}`);
    } else {
      console.log("\n❌ Indicators table not found");
    }

    // Check user_indicator_scope table
    if (
      tableCheck.rows.some((row) => row.table_name === "user_indicator_scope")
    ) {
      const scopeCount = await client.query(
        "SELECT COUNT(*) as count FROM user_indicator_scope"
      );
      console.log(
        `\n👥 User indicator scope records: ${scopeCount.rows[0].count}`
      );
    } else {
      console.log("\n❌ User indicator scope table not found");
    }

    // Check states table
    if (tableCheck.rows.some((row) => row.table_name === "states")) {
      const statesCount = await client.query(
        "SELECT COUNT(*) as count FROM states"
      );
      console.log(`\n🏛️ States records: ${statesCount.rows[0].count}`);
    } else {
      console.log("\n❌ States table not found");
    }

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
  } catch (error) {
    console.error("❌ Database check failed:", error.message);

    if (error.message.includes("password authentication failed")) {
      console.log("\n💡 Try these database credentials:");
      console.log("   - Database: niri_dev");
      console.log("   - User: postgres");
      console.log("   - Password: (your postgres password)");
    }
  } finally {
    await client.end();
  }
}

checkIndicatorsDatabase();
