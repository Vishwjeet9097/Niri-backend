import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropSectionStatusColumn20251119 implements MigrationInterface {
  name = 'DropSectionStatusColumn20251119';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the obsolete section_status column
    await queryRunner.query(`ALTER TABLE submissions DROP COLUMN IF EXISTS section_status`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recreate the column (empty array default) if rollback needed
    await queryRunner.query(`ALTER TABLE submissions ADD COLUMN section_status jsonb DEFAULT '[]'`);
  }
}
