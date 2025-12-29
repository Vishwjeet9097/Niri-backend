import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("ministry_indicator_subsections")
@Index(["indicatorId", "sequence"])
export class IndicatorSubsection {
  // Custom primary key format: name_indicator_id
  // Example: subsection_name_INFRA_FINANCING_SECTION_1.1_wer45672
  @PrimaryColumn({ type: "varchar", length: 500 })
  id: string;

  @Column()
  name: string;

  @Column({ name: "indicator_id" })
  indicatorId: string;

  @Column({ type: "integer", default: 0 })
  sequence: number;

  @Column({ name: "status", default: true })
  status: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}

