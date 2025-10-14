import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateSubmissionStatusEnum1700000000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // First, update any existing data that uses old enum values
    await queryRunner.query(`
      UPDATE submissions 
      SET status = 'SUBMITTED_TO_MOSPI_REVIEWER' 
      WHERE status = 'SUBMITTED_TO_MOSPI'
    `);

    // Add new enum values to the existing enum type
    await queryRunner.query(`
      ALTER TYPE "submissions_status_enum" 
      ADD VALUE 'SUBMITTED_TO_MOSPI_REVIEWER'
    `);

    await queryRunner.query(`
      ALTER TYPE "submissions_status_enum" 
      ADD VALUE 'SUBMITTED_TO_MOSPI_APPROVER'
    `);

    await queryRunner.query(`
      ALTER TYPE "submissions_status_enum" 
      ADD VALUE 'DRAFT'
    `);

    await queryRunner.query(`
      ALTER TYPE "submissions_status_enum" 
      ADD VALUE 'REJECTED'
    `);

    await queryRunner.query(`
      ALTER TYPE "submissions_status_enum" 
      ADD VALUE 'REJECTED_FINAL'
    `);

    await queryRunner.query(`
      ALTER TYPE "submissions_status_enum" 
      ADD VALUE 'RETURNED_FROM_STATE'
    `);

    await queryRunner.query(`
      ALTER TYPE "submissions_status_enum" 
      ADD VALUE 'RETURNED_FROM_MOSPI'
    `);

    // Update any NULL or empty status values to DRAFT
    await queryRunner.query(`
      UPDATE submissions 
      SET status = 'DRAFT' 
      WHERE status IS NULL OR status = ''
    `);

    // Add comment to the enum type
    await queryRunner.query(`
      COMMENT ON TYPE "submissions_status_enum" IS 'Status values for NIRI submissions workflow'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL doesn't support removing enum values directly
    // This is a complex operation that would require recreating the enum type
    // For now, we'll just document that this migration cannot be easily reversed
    
    await queryRunner.query(`
      COMMENT ON TYPE "submissions_status_enum" IS 'Status values for NIRI submissions workflow (migration 1700000000006 applied)'
    `);
  }
}
