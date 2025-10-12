import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class UpdateRejectedStatus1760250600000 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
