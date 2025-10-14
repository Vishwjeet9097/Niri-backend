-- Add category_scores column to final_scores table
ALTER TABLE final_scores 
ADD COLUMN category_scores JSONB;

-- Add scoring_version column to final_scores table if it doesn't exist
-- (also noticed this was in the entity but not in the schema)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='final_scores' AND column_name='scoring_version') THEN
        ALTER TABLE final_scores 
        ADD COLUMN scoring_version VARCHAR(10) DEFAULT '2.0';
    END IF;
END $$;