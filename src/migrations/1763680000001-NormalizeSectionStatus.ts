import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Normalizes existing submissions.section_status values to the new counter-based structure:
 * {
 *   totalIndicators: number,
 *   completedIndicators: number,
 *   completedList: string[]
 * }
 * Legacy formats handled:
 *  - null / missing => fresh initialization
 *  - object of { sectionX_Y: { isCompleted: boolean } }
 */
export class NormalizeSectionStatus1763680000001 implements MigrationInterface {
  name = 'NormalizeSectionStatus1763680000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Fetch all submissions with raw section_status
    const submissions: Array<{
      id: string;
      submitted_by: string;
      section_status: any;
    }> = await queryRunner.query(
      `SELECT id, submitted_by, section_status FROM submissions`
    );

    for (const row of submissions) {
      let normalized: {
        totalIndicators: number;
        completedIndicators: number;
        completedList: string[];
      } | null = null;

      const raw = row.section_status;

      // Determine totalIndicators via user assignments (active indicators only)
      let totalIndicators = 0;
      try {
        const countRes: Array<{ count: string }> = await queryRunner.query(
          `SELECT COUNT(*)::text AS count
           FROM user_indicator_scope uis
           JOIN indicators i ON i.id = uis.indicator_id
           WHERE uis.user_id = $1 AND i.is_active = true`,
          [row.submitted_by]
        );
        totalIndicators = parseInt(countRes?.[0]?.count || '0', 10);
      } catch {
        totalIndicators = 0; // fallback
      }

      // Legacy shape: object of section keys
      if (raw && typeof raw === 'object' && !Array.isArray(raw) && raw.totalIndicators === undefined) {
        const completedList: string[] = [];
        for (const [k, v] of Object.entries(raw)) {
          if (/^section\d+_\d+$/.test(k) && v && (v as any).isCompleted) {
            completedList.push(k);
          }
        }
        normalized = {
          totalIndicators,
          completedIndicators: completedList.length,
            completedList,
        };
      } else if (
        raw && typeof raw === 'object' &&
        raw.totalIndicators !== undefined &&
        raw.completedIndicators !== undefined &&
        Array.isArray(raw.completedList)
      ) {
        // Already normalized – but ensure totalIndicators matches current assignment count
        normalized = {
          totalIndicators,
          completedIndicators: raw.completedList.length,
          completedList: raw.completedList,
        };
      } else {
        // Null / unsupported => initialize blank
        normalized = {
          totalIndicators,
          completedIndicators: 0,
          completedList: [],
        };
      }

      await queryRunner.query(
        `UPDATE submissions SET section_status = $2::jsonb WHERE id = $1`,
        [row.id, JSON.stringify(normalized)]
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverting to legacy format not supported; set to empty object
    await queryRunner.query(
      `UPDATE submissions SET section_status = '{}'::jsonb`
    );
  }
}
