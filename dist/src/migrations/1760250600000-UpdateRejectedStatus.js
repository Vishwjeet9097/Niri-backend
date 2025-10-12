"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateRejectedStatus1760250600000 = void 0;
class UpdateRejectedStatus1760250600000 {
    constructor() {
        this.name = 'UpdateRejectedStatus1760250600000';
    }
    async up(queryRunner) {
        await queryRunner.query(`ALTER TYPE submissions_status_enum ADD VALUE 'REJECTED'`);
        await queryRunner.query(`UPDATE submissions SET status = 'REJECTED' WHERE status = 'REJECTED_TO_STATE'`);
        await queryRunner.query(`CREATE TYPE submissions_status_enum_new AS ENUM(
      'SUBMITTED_TO_STATE',
      'SUBMITTED_TO_MOSPI',
      'REJECTED',
      'REJECTED_FINAL',
      'APPROVED'
    )`);
        await queryRunner.query(`ALTER TABLE submissions 
      ALTER COLUMN status TYPE submissions_status_enum_new 
      USING status::text::submissions_status_enum_new`);
        await queryRunner.query(`DROP TYPE submissions_status_enum`);
        await queryRunner.query(`ALTER TYPE submissions_status_enum_new RENAME TO submissions_status_enum`);
    }
    async down(queryRunner) {
        await queryRunner.query(`CREATE TYPE submissions_status_enum_old AS ENUM(
      'SUBMITTED_TO_STATE',
      'SUBMITTED_TO_MOSPI',
      'REJECTED_TO_STATE',
      'REJECTED_FINAL',
      'APPROVED'
    )`);
        await queryRunner.query(`UPDATE submissions SET status = 'REJECTED_TO_STATE' WHERE status = 'REJECTED'`);
        await queryRunner.query(`ALTER TABLE submissions 
      ALTER COLUMN status TYPE submissions_status_enum_old 
      USING status::text::submissions_status_enum_old`);
        await queryRunner.query(`DROP TYPE submissions_status_enum`);
        await queryRunner.query(`ALTER TYPE submissions_status_enum_old RENAME TO submissions_status_enum`);
    }
}
exports.UpdateRejectedStatus1760250600000 = UpdateRejectedStatus1760250600000;
//# sourceMappingURL=1760250600000-UpdateRejectedStatus.js.map