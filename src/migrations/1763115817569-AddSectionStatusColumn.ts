import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSectionStatusColumn1763115817569 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add section_status column to submissions table
        await queryRunner.query(`
            ALTER TABLE submissions 
            ADD COLUMN IF NOT EXISTS section_status jsonb DEFAULT '[]'::jsonb
        `);

        // Add comment to explain the column
        await queryRunner.query(`
            COMMENT ON COLUMN submissions.section_status IS 
            'Tracks completion status of each form section/tab'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove section_status column
        await queryRunner.query(`
            ALTER TABLE submissions 
            DROP COLUMN IF EXISTS section_status
        `);
    }

}
