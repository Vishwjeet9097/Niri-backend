import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedMinistriesTable1671800000001 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO "ministries" ("name", "isActive") VALUES
            ('Civil Aviation', true),
            ('Coal', true),
            ('Commerce and Industry', true),
            ('Communications', true),
            ('Education', true),
            ('Finance', true),
            ('Health and Family Welfare', true),
            ('Home Affairs', true),
            ('Housing and Urban Affairs', true),
            ('Water Resources', true),
            ('Mines', true),
            ('Petroleum and Natural Gas', true),
            ('Ports, Shipping and Waterways', true),
            ('Power', true),
            ('Railways', true),
            ('Road Transport and Highways', true),
            ('Steel', true);
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM "ministries" WHERE "name" IN (
                'Civil Aviation',
                'Coal',
                'Commerce and Industry',
                'Communications',
                'Education',
                'Finance',
                'Health and Family Welfare',
                'Home Affairs',
                'Housing and Urban Affairs',
                'Water Resources',
                'Mines',
                'Petroleum and Natural Gas',
                'Ports, Shipping and Waterways',
                'Power',
                'Railways',
                'Road Transport and Highways',
                'Steel'
            );
        `);
    }
}
