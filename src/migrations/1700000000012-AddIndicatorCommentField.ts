import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIndicatorCommentField1700000000012
  implements MigrationInterface
{
  name = "AddIndicatorCommentField1700000000012";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE submissions 
      ADD COLUMN "indicator_comment" JSONB DEFAULT '{}'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE submissions 
      DROP COLUMN "indicator_comment"
    `);
  }
}
