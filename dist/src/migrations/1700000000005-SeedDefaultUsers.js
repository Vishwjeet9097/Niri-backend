"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeedDefaultUsers1700000000005 = void 0;
const bcrypt = require("bcryptjs");
class SeedDefaultUsers1700000000005 {
    async up(queryRunner) {
        const hashedPassword = await bcrypt.hash('password123', 10);
        const users = [
            {
                email: 'nodal.officer@example.com',
                firstName: 'Rajesh',
                lastName: 'Kumar',
                role: 'NODAL_OFFICER',
                stateUt: 'Delhi'
            },
            {
                email: 'state.approver@example.com',
                firstName: 'Priya',
                lastName: 'Sharma',
                role: 'STATE_APPROVER',
                stateUt: 'Delhi'
            },
            {
                email: 'mospi.reviewer@example.com',
                firstName: 'Amit',
                lastName: 'Singh',
                role: 'MOSPI_REVIEWER',
                stateUt: null
            },
            {
                email: 'mospi.approver@example.com',
                firstName: 'Sneha',
                lastName: 'Patel',
                role: 'MOSPI_APPROVER',
                stateUt: null
            },
            {
                email: 'admin@niri.gov.in',
                firstName: 'Admin',
                lastName: 'User',
                role: 'MOSPI_APPROVER',
                stateUt: null
            }
        ];
        for (const user of users) {
            await queryRunner.query(`
        INSERT INTO users (id, email, password, "firstName", "lastName", role, "stateUt", "isActive", "createdAt", "updatedAt")
        VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (email) DO UPDATE SET
          password = EXCLUDED.password,
          "firstName" = EXCLUDED."firstName",
          "lastName" = EXCLUDED."lastName",
          role = EXCLUDED.role,
          "stateUt" = EXCLUDED."stateUt",
          "updatedAt" = CURRENT_TIMESTAMP
      `, [user.email, hashedPassword, user.firstName, user.lastName, user.role, user.stateUt]);
        }
    }
    async down(queryRunner) {
        await queryRunner.query(`
      DELETE FROM users WHERE email IN (
        'nodal.officer@example.com',
        'state.approver@example.com',
        'mospi.reviewer@example.com',
        'mospi.approver@example.com',
        'admin@niri.gov.in'
      )
    `);
    }
}
exports.SeedDefaultUsers1700000000005 = SeedDefaultUsers1700000000005;
//# sourceMappingURL=1700000000005-SeedDefaultUsers.js.map