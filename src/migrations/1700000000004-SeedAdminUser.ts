import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedAdminUser1700000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Hash password using bcrypt (same as auth service)
    // Using a pre-computed bcrypt hash for 'admin123' with salt rounds 10
    const hashedPassword =
      "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi";

    // Insert admin user
    await queryRunner.query(
      `
      INSERT INTO users (
        id,
        email,
        password,
        "firstName",
        "lastName",
        role,
        state_ut,
        "isActive",
        "contactNumber",
        "createdAt",
        "updatedAt"
      ) VALUES (
        uuid_generate_v4(),
        'admin@niri.gov.in',
        $1,
        'System',
        'Administrator',
        'ADMIN',
        'CENTRAL',
        true,
        '+91-9876543210',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `,
      [hashedPassword]
    );

    console.log("✅ Admin user seeded successfully!");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove admin user
    await queryRunner.query(`
      DELETE FROM users 
      WHERE email = 'admin@niri.gov.in' AND role = 'ADMIN'
    `);
  }
}
