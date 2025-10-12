import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateAuditLogsTable1700000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'audit_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'entityType',
            type: 'varchar',
          },
          {
            name: 'entityId',
            type: 'varchar',
          },
          {
            name: 'userId',
            type: 'varchar',
          },
          {
            name: 'userRole',
            type: 'enum',
            enum: ['NODAL_OFFICER', 'STATE_APPROVER', 'MOSPI_REVIEWER', 'MOSPI_APPROVER'],
          },
          {
            name: 'action',
            type: 'varchar',
          },
          {
            name: 'oldValues',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'newValues',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'ipAddress',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'userAgent',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.query(
      `CREATE INDEX IDX_audit_logs_entity ON audit_logs ("entityType", "entityId")`,
    );
    await queryRunner.query(`CREATE INDEX IDX_audit_logs_user_id ON audit_logs ("userId")`);
    await queryRunner.query(`CREATE INDEX IDX_audit_logs_action ON audit_logs (action)`);
    await queryRunner.query(`CREATE INDEX IDX_audit_logs_created_at ON audit_logs ("createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('audit_logs');
  }
}
