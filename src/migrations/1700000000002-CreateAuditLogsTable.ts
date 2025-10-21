import { MigrationInterface, QueryRunner, Table, Index } from "typeorm";

export class CreateAuditLogsTable1700000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create audit_logs_userrole_enum
    await queryRunner.query(`
      CREATE TYPE "public"."audit_logs_userrole_enum" AS ENUM(
        'NODAL_OFFICER',
        'STATE_APPROVER',
        'MOSPI_REVIEWER',
        'MOSPI_APPROVER'
      )
    `);

    // Create audit_logs table
    await queryRunner.createTable(
      new Table({
        name: "audit_logs",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          {
            name: "entity_type",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "entity_id",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "user_id",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "userRole",
            type: "audit_logs_userrole_enum",
            isNullable: false,
          },
          {
            name: "action",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "oldValues",
            type: "jsonb",
            isNullable: true,
          },
          {
            name: "newValues",
            type: "jsonb",
            isNullable: true,
          },
          {
            name: "ip_address",
            type: "varchar",
            isNullable: true,
          },
          {
            name: "user_agent",
            type: "varchar",
            isNullable: true,
          },
          {
            name: "createdAt",
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
      `CREATE INDEX "IDX_audit_logs_entity" ON "audit_logs" ("entity_type", "entity_id")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_user_id" ON "audit_logs" ("user_id")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_action" ON "audit_logs" ("action")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_created_at" ON "audit_logs" ("createdAt")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("audit_logs");
    await queryRunner.query(`DROP TYPE "public"."audit_logs_userrole_enum"`);
  }
}
