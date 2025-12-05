import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateNotificationsTable1764053714942 implements MigrationInterface {
    name = 'CreateNotificationsTable1764053714942'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "message" character varying NOT NULL, "senderId" character varying NOT NULL, "receiverId" character varying NOT NULL, "status" integer NOT NULL DEFAULT '1', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "attached_files" SET DEFAULT '[]'::jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "attached_files" SET DEFAULT '[]'`);
        await queryRunner.query(`DROP TABLE "notifications"`);
    }

}