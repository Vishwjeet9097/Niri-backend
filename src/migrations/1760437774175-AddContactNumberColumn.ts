import { MigrationInterface, QueryRunner } from "typeorm";

export class AddContactNumberColumn1760437774175 implements MigrationInterface {
  name = "AddContactNumberColumn1760437774175";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "contactNumber" character varying`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "contactNumber"`);
  }
}
