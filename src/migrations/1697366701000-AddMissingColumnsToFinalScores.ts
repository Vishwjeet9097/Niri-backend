import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMissingColumnsToFinalScores1697366701000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if category_scores column exists
    const categoryScoresExists = await this.checkColumnExists(
      queryRunner,
      "final_scores",
      "category_scores"
    );
    if (!categoryScoresExists) {
      await queryRunner.query(
        `ALTER TABLE final_scores ADD COLUMN "category_scores" JSONB`
      );
      console.log("Added category_scores column to final_scores table");
    }

    // Check if scoring_version column exists
    const scoringVersionExists = await this.checkColumnExists(
      queryRunner,
      "final_scores",
      "scoring_version"
    );
    if (!scoringVersionExists) {
      await queryRunner.query(
        `ALTER TABLE final_scores ADD COLUMN "scoring_version" VARCHAR(10) DEFAULT '2.0'`
      );
      console.log("Added scoring_version column to final_scores table");
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop scoring_version column if exists
    const scoringVersionExists = await this.checkColumnExists(
      queryRunner,
      "final_scores",
      "scoring_version"
    );
    if (scoringVersionExists) {
      await queryRunner.query(
        `ALTER TABLE final_scores DROP COLUMN IF EXISTS "scoring_version"`
      );
    }

    // Drop category_scores column if exists
    const categoryScoresExists = await this.checkColumnExists(
      queryRunner,
      "final_scores",
      "category_scores"
    );
    if (categoryScoresExists) {
      await queryRunner.query(
        `ALTER TABLE final_scores DROP COLUMN IF EXISTS "category_scores"`
      );
    }
  }

  private async checkColumnExists(
    queryRunner: QueryRunner,
    table: string,
    column: string
  ): Promise<boolean> {
    const result = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = '${table}' AND column_name = '${column}'
      ) as exists;
    `);
    return result[0].exists;
  }
}
