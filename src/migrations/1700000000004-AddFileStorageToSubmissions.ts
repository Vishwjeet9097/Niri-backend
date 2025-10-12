import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFileStorageToSubmissions1700000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE submissions 
      ADD COLUMN attached_files JSONB DEFAULT '[]'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN submissions.attached_files IS 'Array of attached files with metadata'
    `);

    // Add index for better performance when querying submissions with files
    await queryRunner.query(`
      CREATE INDEX IDX_submissions_attached_files 
      ON submissions USING GIN (attached_files)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS IDX_submissions_attached_files
    `);

    await queryRunner.query(`
      ALTER TABLE submissions 
      DROP COLUMN IF EXISTS attached_files
    `);
  }
}
