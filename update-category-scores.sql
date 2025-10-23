-- Update categoryScores for existing records based on score_breakdown calculations
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
updated_at = NOW()
WHERE category_scores IS NULL 
AND score_breakdown IS NOT NULL 
AND score_breakdown->'calculations' IS NOT NULL;
