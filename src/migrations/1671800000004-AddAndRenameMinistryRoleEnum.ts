import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAndRenameMinistryRoleEnum1671800000004 implements MigrationInterface {
    name = 'AddAndRenameMinistryRoleEnum1671800000004'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add 'MINISTRY' value if not exists
        await queryRunner.query(`ALTER TYPE "public"."users_role_enum" ADD VALUE IF NOT EXISTS 'MINISTRY'`);
        // Rename 'MINISTRY' to 'MINISTRY_APPROVER' if it exists
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'users_role_enum') THEN
                    IF EXISTS (SELECT 1 FROM unnest(enum_range(NULL::users_role_enum)) val WHERE val = 'MINISTRY') THEN
                        ALTER TYPE users_role_enum RENAME VALUE 'MINISTRY' TO 'MINISTRY_APPROVER';
                    END IF;
                END IF;
            END$$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Optionally revert the enum value rename
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'users_role_enum') THEN
                    IF EXISTS (SELECT 1 FROM unnest(enum_range(NULL::users_role_enum)) val WHERE val = 'MINISTRY_APPROVER') THEN
                        ALTER TYPE users_role_enum RENAME VALUE 'MINISTRY_APPROVER' TO 'MINISTRY';
                    END IF;
                END IF;
            END$$;
        `);
        // No easy way to remove a value from a Postgres enum, so this is left empty intentionally.
    }
}
