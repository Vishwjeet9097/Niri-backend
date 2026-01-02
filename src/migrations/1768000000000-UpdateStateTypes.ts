import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateStateTypes1768000000000 implements MigrationInterface {
    name = 'UpdateStateTypes1768000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Update States (28 states) - using 'ST' to fit varchar(2) constraint
        // Include both 'OD' and 'OR' for Odisha (some databases use 'OR' for Orissa)
        await queryRunner.query(`
            UPDATE states 
            SET type = 'ST' 
            WHERE code IN (
                'AP', 'AR', 'AS', 'BR', 'CG', 'GA', 'GJ', 'HR', 
                'HP', 'JH', 'KA', 'KL', 'MP', 'MH', 'MN', 'ML', 
                'MZ', 'NL', 'OD', 'OR', 'PB', 'RJ', 'SK', 'TN', 'TG', 
                'TR', 'UP', 'UK', 'WB'
            )
        `);

        // Also update by name as fallback (in case codes don't match)
        await queryRunner.query(`
            UPDATE states 
            SET type = 'ST' 
            WHERE name IN (
                'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 
                'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 
                'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 
                'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 
                'Mizoram', 'Nagaland', 'Odisha', 'Orissa', 'Punjab', 
                'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 
                'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
            )
            AND type IS NULL
        `);

        // Update Union Territories (8 UTs)
        await queryRunner.query(`
            UPDATE states 
            SET type = 'UT' 
            WHERE code IN (
                'AN', 'CH', 'DN', 'DL', 'JK', 'LA', 'LD', 'PY'
            )
        `);

        // Also update UTs by name as fallback
        await queryRunner.query(`
            UPDATE states 
            SET type = 'UT' 
            WHERE name IN (
                'Andaman and Nicobar Islands', 'Chandigarh', 
                'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 
                'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
            )
            AND type IS NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert all types back to NULL
        await queryRunner.query(`
            UPDATE states 
            SET type = NULL
        `);
    }
}

