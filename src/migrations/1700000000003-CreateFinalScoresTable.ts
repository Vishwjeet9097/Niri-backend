import {
  MigrationInterface,
  QueryRunner,
  Table,
  Index,
  ForeignKey,
} from "typeorm";

export class CreateFinalScoresTable1700000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create final_scores table
    await queryRunner.createTable(
      new Table({
        name: "final_scores",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          {
            name: "submission_id",
            type: "uuid",
            isUnique: true,
            isNullable: false,
          },
          {
            name: "state_ut",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "total_score",
            type: "decimal",
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: "score_breakdown",
            type: "jsonb",
            isNullable: false,
          },
          {
            name: "calculation_methodology",
            type: "text",
            isNullable: false,
          },
          {
            name: "approved_by",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "category_scores",
            type: "jsonb",
            isNullable: true,
          },
          {
            name: "scoring_version",
            type: "jsonb",
            isNullable: true,
          },
          {
            name: "percentage",
            type: "jsonb",
            isNullable: true,
          },
          {
            name: "createdAt",
            type: "timestamp",
            isNullable: false,
            default: "CURRENT_TIMESTAMP",
          },
          {
            name: "updatedAt",
            type: "timestamp",
            isNullable: false,
            default: "CURRENT_TIMESTAMP",
          },
        ],
      }),
      true
    );

    // Create indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_final_scores_state_ut" ON "final_scores" ("state_ut")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_final_scores_total_score" ON "final_scores" ("total_score")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_final_scores_created_at" ON "final_scores" ("createdAt")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_final_scores_scoring_version" ON "final_scores" ("scoring_version")`
    );

    // Create foreign key constraint
    await queryRunner.query(`
      ALTER TABLE final_scores 
      ADD CONSTRAINT FK_final_scores_submission_id 
      FOREIGN KEY ("submission_id") REFERENCES submissions(id) ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("final_scores");
  }
}
