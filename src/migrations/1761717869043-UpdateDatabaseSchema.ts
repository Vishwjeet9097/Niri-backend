import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateDatabaseSchema1761717869043 implements MigrationInterface {
  name = "UpdateDatabaseSchema1761717869043";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if ADMIN role already exists before adding
    const enumExists = await queryRunner.query(`
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = 'ADMIN' 
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'users_role_enum')
        `);

    if (enumExists.length === 0) {
      await queryRunner.query(
        `ALTER TYPE "public"."users_role_enum" ADD VALUE 'ADMIN'`
      );
    }

    // Add missing columns to final_scores table
    await queryRunner.query(
      `ALTER TABLE "final_scores" ADD COLUMN IF NOT EXISTS "category_scores" jsonb`
    );
    await queryRunner.query(
      `ALTER TABLE "final_scores" ADD COLUMN IF NOT EXISTS "scoring_version" character varying NOT NULL DEFAULT '2.0'`
    );

    // Add missing columns to user_indicator_scope table
    await queryRunner.query(
      `ALTER TABLE "user_indicator_scope" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`
    );

    // Add missing indicatorComment column to submissions table
    await queryRunner.query(
      `ALTER TABLE "submissions" ADD COLUMN IF NOT EXISTS "indicatorComment" jsonb DEFAULT '{}'::jsonb`
    );

    // Update form_data to be nullable in submissions
    await queryRunner.query(
      `ALTER TABLE "submissions" ALTER COLUMN "form_data" DROP NOT NULL`
    );

    // Fix attached_files column type - skip if already correct
    const columnInfo = await queryRunner.query(`
            SELECT data_type FROM information_schema.columns 
            WHERE table_name = 'submissions' AND column_name = 'attached_files'
        `);

    if (columnInfo.length > 0 && columnInfo[0].data_type === "ARRAY") {
      // Column is already jsonb array, skip conversion
      console.log(
        "attached_files column is already jsonb array, skipping conversion"
      );
    } else {
      // Convert to jsonb if needed
      await queryRunner.query(
        `ALTER TABLE "submissions" ALTER COLUMN "attached_files" TYPE jsonb USING attached_files::jsonb`
      );
      await queryRunner.query(
        `ALTER TABLE "submissions" ALTER COLUMN "attached_files" SET DEFAULT '[]'::jsonb`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: Cannot remove enum values in PostgreSQL, so we'll leave ADMIN role
    await queryRunner.query(
      `ALTER TABLE "submissions" ALTER COLUMN "attached_files" TYPE jsonb array`
    );
    await queryRunner.query(
      `ALTER TABLE "submissions" ALTER COLUMN "form_data" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "user_indicator_scope" DROP COLUMN IF EXISTS "updatedAt"`
    );
    await queryRunner.query(
      `ALTER TABLE "final_scores" DROP COLUMN IF EXISTS "scoring_version"`
    );
    await queryRunner.query(
      `ALTER TABLE "final_scores" DROP COLUMN IF EXISTS "category_scores"`
    );
  }
}
