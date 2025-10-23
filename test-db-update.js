require('dotenv').config();
const { Client } = require('pg');

async function updateCategoryScores() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'niri_db',
    user: process.env.DB_USERNAME || 'niri_user',
    password: process.env.DB_PASSWORD || 'niri_password'
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // First, let's check what we have
    const checkResult = await client.query(`
      SELECT id, submission_id, state_ut, total_score, 
             category_scores IS NULL as has_null_category_scores,
             score_breakdown->'calculations' IS NOT NULL as has_calculations
      FROM final_scores 
      ORDER BY "createdAt" DESC 
      LIMIT 5
    `);

    console.log('\n📊 Current records:');
    checkResult.rows.forEach(row => {
      console.log(`ID: ${row.id}, State: ${row.state_ut}, Score: ${row.total_score}, Has CategoryScores: ${!row.has_null_category_scores}, Has Calculations: ${row.has_calculations}`);
    });

    // Update categoryScores for records that have calculations but null categoryScores
    const updateResult = await client.query(`
      UPDATE final_scores 
      SET category_scores = jsonb_build_object(
        'infraFinancing', jsonb_build_object(
          'score', COALESCE((
            SELECT SUM(CAST(calc->>'score' AS NUMERIC))
            FROM jsonb_array_elements(score_breakdown->'calculations') AS calc
            WHERE (calc->>'indicator') LIKE '1.%'
          ), 0),
          'maxScore', 250,
          'percentage', COALESCE((
            SELECT ROUND((SUM(CAST(calc->>'score' AS NUMERIC)) / 250.0) * 100, 2)
            FROM jsonb_array_elements(score_breakdown->'calculations') AS calc
            WHERE (calc->>'indicator') LIKE '1.%'
          ), 0)
        ),
        'infraDevelopment', jsonb_build_object(
          'score', COALESCE((
            SELECT SUM(CAST(calc->>'score' AS NUMERIC))
            FROM jsonb_array_elements(score_breakdown->'calculations') AS calc
            WHERE (calc->>'indicator') LIKE '2.%'
          ), 0),
          'maxScore', 250,
          'percentage', COALESCE((
            SELECT ROUND((SUM(CAST(calc->>'score' AS NUMERIC)) / 250.0) * 100, 2)
            FROM jsonb_array_elements(score_breakdown->'calculations') AS calc
            WHERE (calc->>'indicator') LIKE '2.%'
          ), 0)
        ),
        'pppDevelopment', jsonb_build_object(
          'score', COALESCE((
            SELECT SUM(CAST(calc->>'score' AS NUMERIC))
            FROM jsonb_array_elements(score_breakdown->'calculations') AS calc
            WHERE (calc->>'indicator') LIKE '3.%'
          ), 0),
          'maxScore', 250,
          'percentage', COALESCE((
            SELECT ROUND((SUM(CAST(calc->>'score' AS NUMERIC)) / 250.0) * 100, 2)
            FROM jsonb_array_elements(score_breakdown->'calculations') AS calc
            WHERE (calc->>'indicator') LIKE '3.%'
          ), 0)
        ),
        'infraEnablers', jsonb_build_object(
          'score', COALESCE((
            SELECT SUM(CAST(calc->>'score' AS NUMERIC))
            FROM jsonb_array_elements(score_breakdown->'calculations') AS calc
            WHERE (calc->>'indicator') LIKE '4.%'
          ), 0),
          'maxScore', 250,
          'percentage', COALESCE((
            SELECT ROUND((SUM(CAST(calc->>'score' AS NUMERIC)) / 250.0) * 100, 2)
            FROM jsonb_array_elements(score_breakdown->'calculations') AS calc
            WHERE (calc->>'indicator') LIKE '4.%'
          ), 0)
        )
      ),
      "updatedAt" = NOW()
      WHERE category_scores IS NULL 
      AND score_breakdown IS NOT NULL 
      AND score_breakdown->'calculations' IS NOT NULL
    `);

    console.log(`\n✅ Updated ${updateResult.rowCount} records`);

    // Verify the update
    const verifyResult = await client.query(`
      SELECT id, submission_id, state_ut, total_score, category_scores
      FROM final_scores 
      WHERE category_scores IS NOT NULL
      ORDER BY "createdAt" DESC 
      LIMIT 3
    `);

    console.log('\n🎯 Updated records:');
    verifyResult.rows.forEach(row => {
      console.log(`\nState: ${row.state_ut}`);
      console.log(`Total Score: ${row.total_score}`);
      if (row.category_scores) {
        const cs = row.category_scores;
        console.log(`Financing: ${cs.infraFinancing?.score || 0}/${cs.infraFinancing?.maxScore || 250} (${cs.infraFinancing?.percentage || 0}%)`);
        console.log(`Development: ${cs.infraDevelopment?.score || 0}/${cs.infraDevelopment?.maxScore || 250} (${cs.infraDevelopment?.percentage || 0}%)`);
        console.log(`PPP: ${cs.pppDevelopment?.score || 0}/${cs.pppDevelopment?.maxScore || 250} (${cs.pppDevelopment?.percentage || 0}%)`);
        console.log(`Enablers: ${cs.infraEnablers?.score || 0}/${cs.infraEnablers?.maxScore || 250} (${cs.infraEnablers?.percentage || 0}%)`);
      }
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

updateCategoryScores();
