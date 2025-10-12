import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateFinalScoresTable1700000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'final_scores',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'submissionId',
            type: 'uuid',
            isUnique: true,
          },
          {
            name: 'stateUt',
            type: 'varchar',
          },
          {
            name: 'totalScore',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'scoreBreakdown',
            type: 'jsonb',
          },
          {
            name: 'calculationMethodology',
            type: 'text',
          },
          {
            name: 'approvedBy',
            type: 'varchar',
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.query(`CREATE INDEX IDX_final_scores_state_ut ON final_scores ("stateUt")`);
    await queryRunner.query(
      `CREATE INDEX IDX_final_scores_total_score ON final_scores ("totalScore")`,
    );
    await queryRunner.query(
      `CREATE INDEX IDX_final_scores_created_at ON final_scores ("createdAt")`,
    );

    await queryRunner.query(`
      ALTER TABLE final_scores 
      ADD CONSTRAINT FK_final_scores_submission_id 
      FOREIGN KEY ("submissionId") REFERENCES submissions(id) ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('final_scores');
  }
}
