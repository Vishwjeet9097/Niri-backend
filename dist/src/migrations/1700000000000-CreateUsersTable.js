"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateUsersTable1700000000000 = void 0;
const typeorm_1 = require("typeorm");
class CreateUsersTable1700000000000 {
    async up(queryRunner) {
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'users',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    generationStrategy: 'uuid',
                    default: 'uuid_generate_v4()',
                },
                {
                    name: 'email',
                    type: 'varchar',
                    isUnique: true,
                },
                {
                    name: 'password',
                    type: 'varchar',
                },
                {
                    name: 'firstName',
                    type: 'varchar',
                },
                {
                    name: 'lastName',
                    type: 'varchar',
                },
                {
                    name: 'role',
                    type: 'enum',
                    enum: ['NODAL_OFFICER', 'STATE_APPROVER', 'MOSPI_REVIEWER', 'MOSPI_APPROVER'],
                },
                {
                    name: 'stateUt',
                    type: 'varchar',
                },
                {
                    name: 'isActive',
                    type: 'boolean',
                    default: true,
                },
                {
                    name: 'createdAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                },
                {
                    name: 'updatedAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                    onUpdate: 'CURRENT_TIMESTAMP',
                },
            ],
        }), true);
        await queryRunner.query(`CREATE INDEX IDX_users_email ON users (email)`);
        await queryRunner.query(`CREATE INDEX IDX_users_state_ut_role ON users ("stateUt", role)`);
    }
    async down(queryRunner) {
        await queryRunner.dropTable('users');
    }
}
exports.CreateUsersTable1700000000000 = CreateUsersTable1700000000000;
//# sourceMappingURL=1700000000000-CreateUsersTable.js.map