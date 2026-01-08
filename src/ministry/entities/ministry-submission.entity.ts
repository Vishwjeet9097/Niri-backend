import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";
import { SubmissionStatus } from "../../entities/submission.entity";

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
    enum: SubmissionStatus,
    default: SubmissionStatus.DRAFT,
  })
  status: SubmissionStatus;

  @Column({ name: "is_consolidated", type: "boolean", default: false, nullable: true })
  isConsolidated: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}

