const { Client } = require("pg");

async function createTablesManually() {
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

    // Create indicators table
    console.log("\n🔨 Creating indicators table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "indicators" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" character varying(50) NOT NULL,
        "section_id" character varying(50) NOT NULL,
        "indicator_name" character varying(255) NOT NULL,
        "category" character varying(255) NOT NULL,
        "max_score" numeric(10,2) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_indicators_code" UNIQUE ("code"),
        CONSTRAINT "PK_indicators" PRIMARY KEY ("id")
      )
    `);
    console.log("✅ Indicators table created");

    // Create states table
    console.log("\n🔨 Creating states table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "states" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying(255) NOT NULL,
        "state_code" character varying(10) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_states_name" UNIQUE ("name"),
        CONSTRAINT "UQ_states_state_code" UNIQUE ("state_code"),
        CONSTRAINT "PK_states" PRIMARY KEY ("id")
      )
    `);
    console.log("✅ States table created");

    // Create user_indicator_scope table
    console.log("\n🔨 Creating user_indicator_scope table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS "user_indicator_scope" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "indicator_id" uuid NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_user_indicator_scope_user_indicator" UNIQUE ("user_id", "indicator_id"),
        CONSTRAINT "PK_user_indicator_scope" PRIMARY KEY ("id")
      )
    `);
    console.log("✅ User indicator scope table created");

    // Add foreign key constraints
    console.log("\n🔗 Adding foreign key constraints...");
    await client.query(`
      ALTER TABLE "user_indicator_scope" 
      ADD CONSTRAINT "FK_user_indicator_scope_user_id" 
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await client.query(`
      ALTER TABLE "user_indicator_scope" 
      ADD CONSTRAINT "FK_user_indicator_scope_indicator_id" 
      FOREIGN KEY ("indicator_id") REFERENCES "indicators"("id") ON DELETE CASCADE
    `);
    console.log("✅ Foreign key constraints added");

    // Insert indicators data
    console.log("\n📊 Inserting indicators data...");
    await client.query(`
      INSERT INTO "indicators" ("code", "section_id", "indicator_name", "category", "max_score") VALUES
      ('1.1', '1', '% of Capex to GSDP', 'Infrastructure Financing', 50.00),
      ('1.2', '1', '% Capex Utilization', 'Infrastructure Financing', 50.00),
      ('1.3', '1', '% of Credit Rated ULBs', 'Infrastructure Financing', 50.00),
      ('1.4', '1', '% of ULBs Issuing Bonds', 'Infrastructure Financing', 50.00),
      ('1.5', '1', 'Functional Financial Intermediary', 'Infrastructure Financing', 50.00),
      ('2.1', '2', 'Availability of Infrastructure Act/Policy', 'Infrastructure Development', 50.00),
      ('2.2', '2', 'Availability of Specialized Entity', 'Infrastructure Development', 50.00),
      ('2.3', '2', 'Sector Infra Development Plan', 'Infrastructure Development', 50.00),
      ('2.4', '2', 'Investment Ready Project Pipeline', 'Infrastructure Development', 50.00),
      ('2.5', '2', 'Asset Monetization Pipeline', 'Infrastructure Development', 50.00),
      ('3.1', '3', 'Availability of PPP Act/Policy', 'PPP Development', 50.00),
      ('3.2', '3', 'Functional PPP Cell/Unit', 'PPP Development', 50.00),
      ('3.3', '3', 'Proposals under VGF/IIPDF', 'PPP Development', 50.00),
      ('3.4', '3', 'Proportion of TPC of PPP Projects', 'PPP Development', 100.00),
      ('4.1', '4', 'All Eligible Infra Projects on NIP Portal', 'Infrastructure Enablers', 50.00),
      ('4.2', '4', 'Availability & Use of State/UT PMG', 'Infrastructure Enablers', 30.00),
      ('4.3', '4', 'Adoption of PM GatiShakti', 'Infrastructure Enablers', 20.00),
      ('4.4', '4', 'Adoption of ADR', 'Infrastructure Enablers', 50.00),
      ('4.5', '4', 'Innovative Practices', 'Infrastructure Enablers', 50.00),
      ('4.6', '4', 'Capacity Building - Officer Participation', 'Infrastructure Enablers', 50.00)
      ON CONFLICT (code) DO NOTHING
    `);
    console.log("✅ Indicators data inserted");

    // Insert states data
    console.log("\n🏛️ Inserting states data...");
    await client.query(`
      INSERT INTO "states" ("name", "state_code") VALUES
      ('Delhi', 'DL'),
      ('Maharashtra', 'MH'),
      ('Karnataka', 'KA'),
      ('Tamil Nadu', 'TN'),
      ('Gujarat', 'GJ'),
      ('Uttar Pradesh', 'UP'),
      ('West Bengal', 'WB'),
      ('Rajasthan', 'RJ'),
      ('Madhya Pradesh', 'MP'),
      ('Punjab', 'PB')
      ON CONFLICT (state_code) DO NOTHING
    `);
    console.log("✅ States data inserted");

    // Verify tables
    console.log("\n🔍 Verifying tables...");
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    console.log("\n📋 All tables in niri_dev database:");
    tables.rows.forEach((row) => {
      console.log(`   ✅ ${row.table_name}`);
    });

    // Check indicators count
    const indicatorsCount = await client.query(
      "SELECT COUNT(*) as count FROM indicators"
    );
    console.log(`\n🎯 Total indicators: ${indicatorsCount.rows[0].count}`);

    // Check states count
    const statesCount = await client.query(
      "SELECT COUNT(*) as count FROM states"
    );
    console.log(`🏛️ Total states: ${statesCount.rows[0].count}`);

    console.log("\n🎉 All tables created successfully!");
  } catch (error) {
    console.error("❌ Error creating tables:", error.message);
  } finally {
    await client.end();
  }
}

createTablesManually();
