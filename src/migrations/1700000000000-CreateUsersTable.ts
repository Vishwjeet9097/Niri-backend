import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateUsersTable1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
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
          },
          {
            name: "password",
            type: "varchar",
          },
          {
            name: "firstName",
            type: "varchar",
          },
          {
            name: "lastName",
            type: "varchar",
          },
          {
            name: "role",
            type: "enum",
            enum: [
              "NODAL_OFFICER",
              "STATE_APPROVER",
              "MOSPI_REVIEWER",
              "MOSPI_APPROVER",
            ],
          },
          {
            name: "state_ut",
            type: "varchar",
          },
          {
            name: "isActive",
            type: "boolean",
            default: true,
          },
          {
            name: "createdAt",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
          {
            name: "updatedAt",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
            onUpdate: "CURRENT_TIMESTAMP",
          },
        ],
      }),
      true
    );

    // Check if indexes already exist before creating them
    try {
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS IDX_users_email ON users (email)`
      );
    } catch (error) {
      console.log("Index on email may already exist, continuing migration");
    }

    try {
      // Note: Using double quotes for case-sensitive column names
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS IDX_users_state_role ON users ("state_ut", role)`
      );
    } catch (error) {
      console.log(
        "Index on stateUt and role may already exist, continuing migration"
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("users");
  }
}
