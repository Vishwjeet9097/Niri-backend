import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("ministry_submission_data")
@Index(["submissionIndicatorId", "inputFieldId"])
export class MinistrySubmissionData {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "submission_indicator_id" })
  submissionIndicatorId: string; // References ministry_submission_indicator.id

  @Column({ name: "input_field_id" })
  inputFieldId: string; // References ministry_input_fields.id

  @Column({ name: "sequence", type: "integer", nullable: true, default: null })
  sequence: number | null; // Sequence number for subsection rows (1, 2, 3, etc.)

  @Column({ name: "value_text", type: "text", nullable: true })
  valueText: string | null;

  @Column({ name: "value_number", type: "decimal", precision: 10, scale: 2, nullable: true })
  valueNumber: number | null;

  @Column({ name: "value_date", type: "date", nullable: true })
  valueDate: Date | null;

  @Column({ name: "value_json", type: "jsonb", nullable: true })
  valueJson: any | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}

