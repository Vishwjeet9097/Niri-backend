import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddMinistryIdToUserTable1671800000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "users",
      new TableColumn({
        name: "ministryId",
        type: "varchar",
        isNullable: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("users", "ministryId");
  }
}
