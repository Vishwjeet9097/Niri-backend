require('dotenv').config();
const { Client } = require('pg');

async function verifyCategoryScores() {
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

    // Check the updated record
    const result = await client.query(`
      SELECT id, submission_id, state_ut, total_score, percentage, category_scores
      FROM final_scores 
      WHERE category_scores IS NOT NULL
      ORDER BY "createdAt" DESC 
      LIMIT 1
    `);

    if (result.rows.length > 0) {
      const row = result.rows[0];
      console.log('\n🎯 Updated Record:');
      console.log(`ID: ${row.id}`);
      console.log(`State: ${row.state_ut}`);
      console.log(`Total Score: ${row.total_score}`);
      console.log(`Percentage: ${row.percentage}`);
      
      if (row.category_scores) {
        console.log('\n📊 Category Scores:');
        const cs = row.category_scores;
        console.log(`Financing: ${cs.infraFinancing?.score || 0}/${cs.infraFinancing?.maxScore || 250} (${cs.infraFinancing?.percentage || 0}%)`);
        console.log(`Development: ${cs.infraDevelopment?.score || 0}/${cs.infraDevelopment?.maxScore || 250} (${cs.infraDevelopment?.percentage || 0}%)`);
        console.log(`PPP: ${cs.pppDevelopment?.score || 0}/${cs.pppDevelopment?.maxScore || 250} (${cs.pppDevelopment?.percentage || 0}%)`);
        console.log(`Enablers: ${cs.infraEnablers?.score || 0}/${cs.infraEnablers?.maxScore || 250} (${cs.infraEnablers?.percentage || 0}%)`);
        
        console.log('\n✅ This data will now be available in /scoring/rankings API!');
      }
    } else {
      console.log('❌ No records found with category_scores');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

verifyCategoryScores();
