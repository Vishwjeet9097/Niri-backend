import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIndicatorTables1760437774176 implements MigrationInterface {
  name = "AddIndicatorTables1760437774176";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create indicators table
    await queryRunner.query(`
            CREATE TABLE "indicators" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "code" character varying(50) NOT NULL,
                "section_id" character varying(50) NOT NULL,
                "indicator_name" character varying(255) NOT NULL,
                "category" character varying(255) NOT NULL,
                "max_score" numeric(10,2) NOT NULL,
                "is_active" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_indicators_code" UNIQUE ("code"),
                CONSTRAINT "PK_indicators" PRIMARY KEY ("id")
            )
        `);

    // Create states table
    await queryRunner.query(`
            CREATE TABLE "states" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "name" character varying(255) NOT NULL,
                "state_code" character varying(10) NOT NULL,
                "is_active" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_states_name" UNIQUE ("name"),
                CONSTRAINT "UQ_states_state_code" UNIQUE ("state_code"),
                CONSTRAINT "PK_states" PRIMARY KEY ("id")
            )
        `);

    // Create user_indicator_scope table
    await queryRunner.query(`
            CREATE TABLE "user_indicator_scope" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "user_id" uuid NOT NULL,
                "indicator_id" uuid NOT NULL,
                "is_active" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_user_indicator_scope_user_indicator" UNIQUE ("user_id", "indicator_id"),
                CONSTRAINT "PK_user_indicator_scope" PRIMARY KEY ("id")
            )
        `);

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

    // Create indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_indicators_code" ON "indicators" ("code")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_indicators_section_id" ON "indicators" ("section_id")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_indicator_scope_user_id" ON "user_indicator_scope" ("user_id")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_indicator_scope_indicator_id" ON "user_indicator_scope" ("indicator_id")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_states_name" ON "states" ("name")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_states_state_code" ON "states" ("state_code")`
    );

    // Insert NIRI Indicators
    await queryRunner.query(`
            INSERT INTO "indicators" ("code", "section_id", "indicator_name", "category", "max_score") VALUES
            ('1.1', '1', '% of Capex to GSDP', 'Infrastructure Financing', 50.00),
            ('1.2', '1', '% Capex Utilization', 'Infrastructure Financing', 50.00),
            ('1.3', '1', '% of Credit Rated ULBs', 'Infrastructure Financing', 50.00),
            ('1.4', '1', '% of ULBs Issuing Bonds', 'Infrastructure Financing', 50.00),
            ('1.5', '1', 'Functional Financial Intermediary', 'Infrastructure Financing', 50.00),
            ('2.1', '2', 'Availability of Infrastructure Act/Policy', 'Infrastructure Development', 50.00),
            ('2.2', '2', 'Availability of Specialized Entity', 'Infrastructure Development', 50.00),
            ('2.3', '2', 'Sector Infra Development Plan', 'Infrastructure Development', 50.00),
            ('2.4', '2', 'Investment Ready Project Pipeline', 'Infrastructure Development', 50.00),
            ('2.5', '2', 'Asset Monetization Pipeline', 'Infrastructure Development', 50.00),
            ('3.1', '3', 'Availability of PPP Act/Policy', 'PPP Development', 50.00),
            ('3.2', '3', 'Functional PPP Cell/Unit', 'PPP Development', 50.00),
            ('3.3', '3', 'Proposals under VGF/IIPDF', 'PPP Development', 50.00),
            ('3.4', '3', 'Proportion of TPC of PPP Projects', 'PPP Development', 100.00),
            ('4.1', '4', 'All Eligible Infra Projects on NIP Portal', 'Infrastructure Enablers', 50.00),
            ('4.2', '4', 'Availability & Use of State/UT PMG', 'Infrastructure Enablers', 30.00),
            ('4.3', '4', 'Adoption of PM GatiShakti', 'Infrastructure Enablers', 20.00),
            ('4.4', '4', 'Adoption of ADR', 'Infrastructure Enablers', 50.00),
            ('4.5', '4', 'Innovative Practices', 'Infrastructure Enablers', 50.00),
            ('4.6', '4', 'Capacity Building - Officer Participation', 'Infrastructure Enablers', 50.00)
        `);

    // Insert sample states
    await queryRunner.query(`
            INSERT INTO "states" ("name", "state_code") VALUES
            ('Delhi', 'DL'),
            ('Maharashtra', 'MH'),
            ('Karnataka', 'KA'),
            ('Tamil Nadu', 'TN'),
            ('Gujarat', 'GJ'),
            ('Uttar Pradesh', 'UP'),
            ('West Bengal', 'WB'),
            ('Rajasthan', 'RJ'),
            ('Madhya Pradesh', 'MP'),
            ('Punjab', 'PB')
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.query(
      `ALTER TABLE "user_indicator_scope" DROP CONSTRAINT "FK_user_indicator_scope_indicator_id"`
    );
    await queryRunner.query(
      `ALTER TABLE "user_indicator_scope" DROP CONSTRAINT "FK_user_indicator_scope_user_id"`
    );

    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_states_state_code"`);
    await queryRunner.query(`DROP INDEX "IDX_states_name"`);
    await queryRunner.query(
      `DROP INDEX "IDX_user_indicator_scope_indicator_id"`
    );
    await queryRunner.query(`DROP INDEX "IDX_user_indicator_scope_user_id"`);
    await queryRunner.query(`DROP INDEX "IDX_indicators_section_id"`);
    await queryRunner.query(`DROP INDEX "IDX_indicators_code"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "user_indicator_scope"`);
    await queryRunner.query(`DROP TABLE "states"`);
    await queryRunner.query(`DROP TABLE "indicators"`);
  }
}
