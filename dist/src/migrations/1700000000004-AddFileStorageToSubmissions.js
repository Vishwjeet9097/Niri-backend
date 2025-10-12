"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddFileStorageToSubmissions1700000000004 = void 0;
class AddFileStorageToSubmissions1700000000004 {
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE submissions 
      ADD COLUMN attached_files JSONB DEFAULT '[]'
    `);
        await queryRunner.query(`
      COMMENT ON COLUMN submissions.attached_files IS 'Array of attached files with metadata'
    `);
        await queryRunner.query(`
      CREATE INDEX IDX_submissions_attached_files 
      ON submissions USING GIN (attached_files)
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
      DROP INDEX IF EXISTS IDX_submissions_attached_files
    `);
        await queryRunner.query(`
      ALTER TABLE submissions 
      DROP COLUMN IF EXISTS attached_files
    `);
    }
}
exports.AddFileStorageToSubmissions1700000000004 = AddFileStorageToSubmissions1700000000004;
//# sourceMappingURL=1700000000004-AddFileStorageToSubmissions.js.map