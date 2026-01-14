import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

export enum MinistrySubmissionStatus {
  DRAFT = "DRAFT",
  SUBMITTED_TO_MINISTRY = "SUBMITTED_TO_MINISTRY",
  SUBMITTED_TO_MOSPI_REVIEWER = "SUBMITTED_TO_MOSPI_REVIEWER",
  SUBMITTED_TO_MOSPI_APPROVER = "SUBMITTED_TO_MOSPI_APPROVER",
  REJECTED = "REJECTED",
  REJECTED_FINAL = "REJECTED_FINAL",
  RETURNED_FROM_MINISTRY = "RETURNED_FROM_MINISTRY",
  RETURNED_FROM_MOSPI = "RETURNED_FROM_MOSPI",
  APPROVED = "APPROVED",
}

@Entity("ministry_submission")
@Index(["submissionId"], { unique: true })
@Index(["formId"])
@Index(["userId"])
@Index(["status"])
export class MinistrySubmission {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "submission_id", unique: true })
  submissionId: string; // Format: SUB-{year}-{randomNum}

  @Column({ name: "form_id" })
  formId: string; // References ministry_form.id

  @Column({ name: "user_id" })
  userId: string; // References users.id

  @Column({
    type: "enum",
    enum: MinistrySubmissionStatus,
    nullable: true,
    default: null,
  })
  status: MinistrySubmissionStatus | null;

  @Column({ name: "is_consolidated", type: "boolean", default: false, nullable: true })
  isConsolidated: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}

