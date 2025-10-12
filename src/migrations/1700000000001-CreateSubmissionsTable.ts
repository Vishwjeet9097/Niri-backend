import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateSubmissionsTable1700000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'submissions',
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
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'stateUt',
            type: 'varchar',
          },
          {
            name: 'submittedBy',
            type: 'uuid',
          },
          {
            name: 'rejectionCount',
            type: 'integer',
            default: 0,
          },
          {
            name: 'formData',
            type: 'jsonb',
          },
          {
            name: 'reviewComments',
            type: 'jsonb',
            default: "'[]'",
          },
          {
            name: 'status',
            type: 'enum',
            enum: [
              'SUBMITTED_TO_STATE',
              'SUBMITTED_TO_MOSPI',
              'REJECTED',
              'REJECTED_FINAL',
              'APPROVED',
            ],
            default: "'SUBMITTED_TO_STATE'",
          },
          {
            name: 'currentOwnerRole',
            type: 'enum',
            enum: ['NODAL_OFFICER', 'STATE_APPROVER', 'MOSPI_REVIEWER', 'MOSPI_APPROVER'],
            default: "'STATE_APPROVER'",
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

    await queryRunner.query(`CREATE INDEX IDX_submissions_state_ut ON submissions ("stateUt")`);
    await queryRunner.query(`CREATE INDEX IDX_submissions_status ON submissions (status)`);
    await queryRunner.query(
      `CREATE INDEX IDX_submissions_submitted_by ON submissions ("submittedBy")`,
    );
    await queryRunner.query(
      `CREATE INDEX IDX_submissions_current_owner_role ON submissions ("currentOwnerRole")`,
    );

    await queryRunner.query(`
      ALTER TABLE submissions 
      ADD CONSTRAINT FK_submissions_submitted_by 
      FOREIGN KEY ("submittedBy") REFERENCES users(id) ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('submissions');
  }
}
