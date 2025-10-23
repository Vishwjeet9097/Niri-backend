import { MigrationInterface, QueryRunner, Table, Index } from "typeorm";

export class CreateUsersTable1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create users_role_enum
    await queryRunner.query(`
      CREATE TYPE "public"."users_role_enum" AS ENUM(
        'NODAL_OFFICER', 
        'STATE_APPROVER', 
        'MOSPI_REVIEWER', 
        'MOSPI_APPROVER', 
        'ADMIN'
      )
    `);

    // Create users table
    await queryRunner.createTable(
      new Table({
        name: "users",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          {
            name: "email",
            type: "varchar",
            isUnique: true,
            isNullable: false,
          },
          {
            name: "password",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "firstName",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "lastName",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "role",
            type: "users_role_enum",
            isNullable: false,
          },
          {
            name: "state_ut",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "isActive",
            type: "boolean",
            isNullable: false,
            default: true,
          },
          {
            name: "contactNumber",
            type: "varchar",
            isNullable: true,
          },
          {
            name: "createdAt",
            type: "timestamp",
            isNullable: false,
            default: "CURRENT_TIMESTAMP",
          },
          {
            name: "updatedAt",
            type: "timestamp",
            isNullable: false,
            default: "CURRENT_TIMESTAMP",
          },
        ],
      }),
      true
    );

    // Create indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_users_email" ON "users" ("email")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_state_role" ON "users" ("state_ut", "role")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("users");
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
  }
}
