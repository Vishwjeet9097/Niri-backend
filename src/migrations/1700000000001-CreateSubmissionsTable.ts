import {
  MigrationInterface,
  QueryRunner,
  Table,
  Index,
  ForeignKey,
} from "typeorm";

export class CreateSubmissionsTable1700000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create submissions_status_enum
    await queryRunner.query(`
      CREATE TYPE "public"."submissions_status_enum" AS ENUM(
        'DRAFT',
        'SUBMITTED_TO_STATE',
        'SUBMITTED_TO_MOSPI_REVIEWER',
        'SUBMITTED_TO_MOSPI_APPROVER',
        'REJECTED',
        'REJECTED_FINAL',
        'RETURNED_FROM_STATE',
        'RETURNED_FROM_MOSPI',
        'APPROVED'
      )
    `);

    // Create submissions_current_owner_role_enum
    await queryRunner.query(`
      CREATE TYPE "public"."submissions_current_owner_role_enum" AS ENUM(
        'NODAL_OFFICER',
        'STATE_APPROVER',
        'MOSPI_REVIEWER',
        'MOSPI_APPROVER'
      )
    `);

    // Create submissions table
    await queryRunner.createTable(
      new Table({
        name: "submissions",
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
            type: "varchar",
            isUnique: true,
            isNullable: false,
          },
          {
            name: "state_ut",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "submitted_by",
            type: "uuid",
            isNullable: false,
          },
          {
            name: "rejection_count",
            type: "integer",
            isNullable: false,
            default: 0,
          },
          {
            name: "form_data",
            type: "jsonb",
            isNullable: false,
          },
          {
            name: "review_comments",
            type: "jsonb",
            isNullable: false,
            default: "'[]'",
          },
          {
            name: "attached_files",
            type: "jsonb",
            isNullable: false,
            default: "'[]'",
          },
          {
            name: "status",
            type: "submissions_status_enum",
            isNullable: false,
            default: "'SUBMITTED_TO_STATE'",
          },
          {
            name: "current_owner_role",
            type: "submissions_current_owner_role_enum",
            isNullable: false,
            default: "'STATE_APPROVER'",
          },
          {
            name: "indicator_comment",
            type: "jsonb",
            isNullable: true,
            default: "'{}'",
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
      `CREATE INDEX "IDX_submissions_state_ut" ON "submissions" ("state_ut")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_submissions_status" ON "submissions" ("status")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_submissions_submitted_by" ON "submissions" ("submitted_by")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_submissions_current_owner_role" ON "submissions" ("current_owner_role")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_submissions_attached_files" ON "submissions" USING GIN ("attached_files")`
    );

    // Create foreign key constraint
    await queryRunner.query(`
      ALTER TABLE submissions 
      ADD CONSTRAINT FK_submissions_submitted_by 
      FOREIGN KEY ("submitted_by") REFERENCES users(id) ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("submissions");
    await queryRunner.query(`DROP TYPE "public"."submissions_status_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."submissions_current_owner_role_enum"`
    );
  }
}
