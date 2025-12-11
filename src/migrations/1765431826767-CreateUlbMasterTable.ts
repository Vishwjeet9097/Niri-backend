import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUlbMasterTable1765431826767 implements MigrationInterface {
    name = 'CreateUlbMasterTable1765431826767'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create enum type if it doesn't exist
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "public"."ulb_masters_status_enum" AS ENUM('0', '1');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);
        
        await queryRunner.query(`CREATE TABLE "ulb_masters" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "state_name" character varying(255) NOT NULL, "city_name" character varying(255) NOT NULL, "ulb_name" character varying(255), "ulb_type" character varying(255), "status" "public"."ulb_masters_status_enum" NOT NULL DEFAULT '1', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c605169bd8a6e91f8758cb9315a" PRIMARY KEY ("id"))`);
     }

    public async down(queryRunner: QueryRunner): Promise<void> {
         await queryRunner.query(`DROP TABLE "ulb_masters"`);
        await queryRunner.query(`DROP TYPE "public"."ulb_masters_status_enum"`);
    }

}
