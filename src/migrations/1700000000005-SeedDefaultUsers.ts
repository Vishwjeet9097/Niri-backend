import { MigrationInterface, QueryRunner } from "typeorm";
import * as bcrypt from "bcryptjs";

export class SeedDefaultUsers1700000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if users already exist
    const existingUsers = await queryRunner.query(
      'SELECT COUNT(*) as count FROM users WHERE email LIKE "%@niri.gov.in"'
    );
    
    if (existingUsers[0].count > 0) {
      console.log('Default users already exist, skipping seed...');
      return;
    }

    // Use hardcoded hash that we know works
    const hashedPassword = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/8KzKz2K";

    // Insert default users
    await queryRunner.query(`
      INSERT INTO users (id, email, password, "firstName", "lastName", role, "stateUt", "isActive", "createdAt", "updatedAt") VALUES
      ('11111111-1111-1111-1111-111111111111', 'nodal@niri.gov.in', $1, 'Nodal', 'Officer', 'NODAL_OFFICER', 'Maharashtra', true, NOW(), NOW()),
      ('22222222-2222-2222-2222-222222222222', 'state@niri.gov.in', $1, 'State', 'Approver', 'STATE_APPROVER', 'Maharashtra', true, NOW(), NOW()),
      ('33333333-3333-3333-3333-333333333333', 'mospi.reviewer@niri.gov.in', $1, 'MoSPI', 'Reviewer', 'MOSPI_REVIEWER', 'Central', true, NOW(), NOW()),
      ('44444444-4444-4444-4444-444444444444', 'mospi.approver@niri.gov.in', $1, 'MoSPI', 'Approver', 'MOSPI_APPROVER', 'Central', true, NOW(), NOW())
    `, [hashedPassword]);

    console.log('✅ Default users seeded successfully!');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove seeded users
    await queryRunner.query(`
      DELETE FROM users WHERE id IN (
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222',
        '33333333-3333-3333-3333-333333333333',
        '44444444-4444-4444-4444-444444444444'
      )
    `);
  }
}
