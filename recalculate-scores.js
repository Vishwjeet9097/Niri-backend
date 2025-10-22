const { Client } = require('pg');

// Database connection
const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'niri_db',
  user: 'niri_user',
  password: 'niri_password'
});

async function recalculateAllScores() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Get all submissions that have scores but missing categoryScores
    const result = await client.query(`
      SELECT fs.id, fs.submission_id, fs.state_ut, fs.total_score, fs.percentage, fs.score_breakdown
      FROM final_scores fs
      WHERE fs.category_scores IS NULL
      ORDER BY fs.created_at DESC
    `);

    console.log(`Found ${result.rows.length} records to recalculate`);

    for (const row of result.rows) {
      try {
        console.log(`\nProcessing submission: ${row.submission_id}`);
        
        // Extract form data from score_breakdown
        const scoreBreakdown = row.score_breakdown;
        if (!scoreBreakdown || !scoreBreakdown.calculations) {
          console.log(`Skipping ${row.submission_id} - no calculations found`);
          continue;
        }

        // Calculate category scores from existing calculations
        const calculations = scoreBreakdown.calculations;
        
        const categoryScores = {
          infraFinancing: { score: 0, maxScore: 250, percentage: 0 },
          infraDevelopment: { score: 0, maxScore: 250, percentage: 0 },
          pppDevelopment: { score: 0, maxScore: 250, percentage: 0 },
          infraEnablers: { score: 0, maxScore: 250, percentage: 0 }
        };

        // Group calculations by category
        calculations.forEach(calc => {
          const indicator = calc.indicator;
          const score = parseFloat(calc.score) || 0;
          
          if (indicator.startsWith('1.')) {
            categoryScores.infraFinancing.score += score;
          } else if (indicator.startsWith('2.')) {
            categoryScores.infraDevelopment.score += score;
          } else if (indicator.startsWith('3.')) {
            categoryScores.pppDevelopment.score += score;
          } else if (indicator.startsWith('4.')) {
            categoryScores.infraEnablers.score += score;
          }
        });

        // Calculate percentages
        Object.keys(categoryScores).forEach(key => {
          const category = categoryScores[key];
          category.percentage = category.maxScore > 0 ? 
            Math.round((category.score / category.maxScore) * 100 * 100) / 100 : 0;
        });

        // Update the record
        await client.query(`
          UPDATE final_scores 
          SET category_scores = $1, updated_at = NOW()
          WHERE id = $2
        `, [JSON.stringify(categoryScores), row.id]);

        console.log(`Updated ${row.submission_id}:`, {
          infraFinancing: `${categoryScores.infraFinancing.score}/${categoryScores.infraFinancing.maxScore}`,
          infraDevelopment: `${categoryScores.infraDevelopment.score}/${categoryScores.infraDevelopment.maxScore}`,
          pppDevelopment: `${categoryScores.pppDevelopment.score}/${categoryScores.pppDevelopment.maxScore}`,
          infraEnablers: `${categoryScores.infraEnablers.score}/${categoryScores.infraEnablers.maxScore}`
        });

      } catch (error) {
        console.error(`Error processing ${row.submission_id}:`, error.message);
      }
    }

    console.log('\n✅ Recalculation completed!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

recalculateAllScores();
