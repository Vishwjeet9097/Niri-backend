import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeFormDataJsonb1761445483961 implements MigrationInterface {
    name = 'MakeFormDataJsonb1761445483961'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_indicator_scope" DROP CONSTRAINT "FK_user_indicator_scope_user_id"`);
        await queryRunner.query(`ALTER TABLE "user_indicator_scope" DROP CONSTRAINT "FK_user_indicator_scope_indicator_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_indicators_code"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_indicators_section_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_indicators_category"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_user_indicator_scope_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_user_indicator_scope_indicator_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_user_indicator_scope_unique"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_states_name"`);
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "form_data" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "submissions" ALTER COLUMN "form_data" SET NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_states_name" ON "states" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_user_indicator_scope_unique" ON "user_indicator_scope" ("indicator_id", "user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_user_indicator_scope_indicator_id" ON "user_indicator_scope" ("indicator_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_user_indicator_scope_user_id" ON "user_indicator_scope" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_indicators_category" ON "indicators" ("category") `);
        await queryRunner.query(`CREATE INDEX "IDX_indicators_section_id" ON "indicators" ("section_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_indicators_code" ON "indicators" ("code") `);
        await queryRunner.query(`ALTER TABLE "user_indicator_scope" ADD CONSTRAINT "FK_user_indicator_scope_indicator_id" FOREIGN KEY ("indicator_id") REFERENCES "indicators"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_indicator_scope" ADD CONSTRAINT "FK_user_indicator_scope_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
