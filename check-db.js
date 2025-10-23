const { Client } = require("pg");

async function checkDatabase() {
  const client = new Client({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_DATABASE || "niri_dev",
    user: process.env.DB_USERNAME || "niri_user",
    password: process.env.DB_PASSWORD || "niri_password",
  });

  try {
    await client.connect();
    console.log("✅ Connected to database");

    // Check if indicators table exists
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('indicators', 'user_indicator_scope')
    `);

    console.log("\n📊 Tables found:");
    tableCheck.rows.forEach((row) => {
      console.log(`   - ${row.table_name}`);
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
    }
  } catch (error) {
    console.error("❌ Database check failed:", error.message);
  } finally {
    await client.end();
  }
}

checkDatabase();
