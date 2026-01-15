import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

export enum IndicatorCategory {
  INFRA_FINANCING = "Infra Financing",
  INFRA_ENABLERS = "Infra Enablers",
  INFRA_DEVELOPMENT = "Infra Development",
  PPP_DEVELOPMENT = "PPP Development",
}

@Entity("ministry_indicator_details")
@Index(["sNo"], { unique: true })
export class IndicatorDetail {
  // Custom primary key format: CATEGORY_CATEGORYNAME_SECTION_X.X_randomString
  // Example: INFRA_FINANCING_SECTION_1.1_wer45672
  @PrimaryColumn({ type: "varchar", length: 255 })
  id: string;

  @Column({ name: "s_no", type: "varchar", length: 50 })
  sNo: string;

  @Column()
  name: string;

  @Column({
    type: "enum",
    enum: IndicatorCategory,
  })
  category: IndicatorCategory;

  @Column({ type: "integer", default: 0 })
  sequence: number;

  @Column({ name: "status", default: true })
  status: boolean;

  // Associated form identifier - reserved for future use (no relation currently)
  @Column({ name: "associated_form", type: "varchar", nullable: true })
  associatedForm: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}

