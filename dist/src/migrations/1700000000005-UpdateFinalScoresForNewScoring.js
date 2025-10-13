"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateFinalScoresForNewScoring1700000000005 = void 0;
class UpdateFinalScoresForNewScoring1700000000005 {
    constructor() {
        this.name = 'UpdateFinalScoresForNewScoring1700000000005';
    }
    async up(queryRunner) {
        await queryRunner.query(`
      ALTER TABLE "final_scores" 
      ADD COLUMN "category_scores" jsonb,
      ADD COLUMN "scoring_version" varchar DEFAULT '2.0'
    `);
        await queryRunner.query(`
      UPDATE "final_scores" 
      SET "scoring_version" = '1.0' 
      WHERE "scoring_version" IS NULL
    `);
        await queryRunner.query(`
      CREATE INDEX "IDX_final_scores_scoring_version" ON "final_scores" ("scoring_version")
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX "IDX_final_scores_scoring_version"`);
        await queryRunner.query(`
      ALTER TABLE "final_scores" 
      DROP COLUMN "category_scores",
      DROP COLUMN "scoring_version"
    `);
    }
}
exports.UpdateFinalScoresForNewScoring1700000000005 = UpdateFinalScoresForNewScoring1700000000005;
//# sourceMappingURL=1700000000005-UpdateFinalScoresForNewScoring.js.map