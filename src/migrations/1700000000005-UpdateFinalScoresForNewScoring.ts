import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateFinalScoresForNewScoring1700000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new columns for enhanced scoring system
    await queryRunner.query(`
      ALTER TABLE "final_scores" 
      ADD COLUMN "category_scores" jsonb,
      ADD COLUMN "scoring_version" varchar DEFAULT '2.0'
    `);

    // Update existing records to have scoring version 1.0
    await queryRunner.query(`
      UPDATE "final_scores" 
      SET "scoring_version" = '1.0' 
      WHERE "scoring_version" IS NULL
    `);

    // Create index for scoring version
    await queryRunner.query(`
      CREATE INDEX "IDX_final_scores_scoring_version" ON "final_scores" ("scoring_version")
    `);

    // Add comment to table for documentation
    await queryRunner.query(`
      COMMENT ON TABLE "final_scores" IS 'Stores calculated scores for NIRI submissions with detailed breakdown and methodology'
    `);

    // Add comments to new columns
    await queryRunner.query(`
      COMMENT ON COLUMN "final_scores"."category_scores" IS 'JSON object containing scores for each category (Infra Financing, Development, PPP, Enablers)'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "final_scores"."scoring_version" IS 'Version of the scoring methodology used (1.0 for old, 2.0 for new detailed rubric)'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(`DROP INDEX "IDX_final_scores_scoring_version"`);
    
    // Drop new columns
    await queryRunner.query(`
      ALTER TABLE "final_scores" 
      DROP COLUMN "category_scores",
      DROP COLUMN "scoring_version"
    `);
  }
}
