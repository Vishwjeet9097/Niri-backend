import { MigrationInterface, QueryRunner, Table, Index } from "typeorm";

export class CreateIndicatorTables1760437775000 implements MigrationInterface {
  name = "CreateIndicatorTables1760437775000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create indicators table
    await queryRunner.createTable(
      new Table({
        name: "indicators",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          {
            name: "code",
            type: "varchar",
            isUnique: true,
          },
          {
            name: "section_id",
            type: "varchar",
          },
          {
            name: "name",
            type: "varchar",
          },
          {
            name: "description",
            type: "text",
            isNullable: true,
          },
          {
            name: "max_score",
            type: "decimal",
            precision: 10,
            scale: 2,
          },
          {
            name: "weight",
            type: "decimal",
            precision: 5,
            scale: 4,
          },
          {
            name: "isActive",
            type: "boolean",
            default: true,
          },
          {
            name: "createdAt",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
          {
            name: "updatedAt",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
            onUpdate: "CURRENT_TIMESTAMP",
          },
        ],
      }),
      true
    );

    // Create user_indicator_scope table
    await queryRunner.createTable(
      new Table({
        name: "user_indicator_scope",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          {
            name: "user_id",
            type: "uuid",
          },
          {
            name: "indicator_id",
            type: "uuid",
          },
          {
            name: "createdAt",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
        ],
      }),
      true
    );

    // Create indexes using raw SQL (only if they don't exist)
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_indicators_code" ON "indicators" ("code")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_indicators_section_id" ON "indicators" ("section_id")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_indicator_scope_user_id" ON "user_indicator_scope" ("user_id")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_indicator_scope_indicator_id" ON "user_indicator_scope" ("indicator_id")`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_user_indicator_scope_unique" ON "user_indicator_scope" ("user_id", "indicator_id")`
    );

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "user_indicator_scope" 
      ADD CONSTRAINT "FK_user_indicator_scope_user_id" 
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "user_indicator_scope" 
      ADD CONSTRAINT "FK_user_indicator_scope_indicator_id" 
      FOREIGN KEY ("indicator_id") REFERENCES "indicators"("id") ON DELETE CASCADE
    `);

    // Insert sample indicators data
    await queryRunner.query(`
      INSERT INTO "indicators" ("code", "section_id", "name", "description", "max_score", "weight") VALUES
      ('1.1', '1', 'Infrastructure Financing - Capex to GSDP', 'Percentage of Capex allocation to GSDP', 50, 0.05),
      ('1.2', '1', 'Infrastructure Financing - Capex Utilization', 'Percentage of Capex utilization', 50, 0.05),
      ('1.3', '1', 'Infrastructure Financing - Credit Rated ULBs', 'Percentage of Credit Rated ULBs', 50, 0.05),
      ('1.4', '1', 'Infrastructure Financing - ULB Bonds', 'Percentage of ULBs issuing bonds', 50, 0.05),
      ('1.5', '1', 'Infrastructure Financing - Financial Intermediary', 'Functional Financial Intermediary', 50, 0.05),
      ('2.1', '2', 'Infrastructure Development - Infrastructure Act', 'Availability of Infrastructure Act/Policy', 50, 0.05),
      ('2.2', '2', 'Infrastructure Development - Specialized Entity', 'Availability of Specialized Entity', 50, 0.05),
      ('2.3', '2', 'Infrastructure Development - Sector Plan', 'Sector Infrastructure Development Plan', 50, 0.05),
      ('2.4', '2', 'Infrastructure Development - Project Pipeline', 'Investment Ready Project Pipeline', 50, 0.05),
      ('2.5', '2', 'Infrastructure Development - Asset Monetization', 'Asset Monetization Pipeline', 50, 0.05),
      ('3.1', '3', 'PPP Development - PPP Act', 'Availability of PPP Act/Policy', 50, 0.05),
      ('3.2', '3', 'PPP Development - PPP Cell', 'Functional PPP Cell/Unit', 50, 0.05),
      ('3.3', '3', 'PPP Development - VGF Proposals', 'Proposals under VGF/IIPDF', 50, 0.05),
      ('3.4', '3', 'PPP Development - TPC Proportion', 'Proportion of TPC of PPP Projects', 100, 0.10),
      ('4.1', '4', 'Infrastructure Enablers - NIP Portal', 'All Eligible Infra Projects on NIP Portal', 50, 0.05),
      ('4.2', '4', 'Infrastructure Enablers - State PMG', 'Availability & Use of State/UT PMG', 30, 0.03),
      ('4.3', '4', 'Infrastructure Enablers - GatiShakti', 'Adoption of PM GatiShakti', 20, 0.02),
      ('4.4', '4', 'Infrastructure Enablers - ADR', 'Adoption of ADR', 50, 0.05),
      ('4.5', '4', 'Infrastructure Enablers - Innovative Practices', 'Innovative Practices', 50, 0.05),
      ('4.6', '4', 'Infrastructure Enablers - Capacity Building', 'Capacity Building - Officer Participation', 50, 0.05)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "user_indicator_scope" 
      DROP CONSTRAINT "FK_user_indicator_scope_indicator_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "user_indicator_scope" 
      DROP CONSTRAINT "FK_user_indicator_scope_user_id"
    `);

    // Drop tables
    await queryRunner.dropTable("user_indicator_scope");
    await queryRunner.dropTable("indicators");
  }
}
