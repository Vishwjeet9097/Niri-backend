import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

export enum SubmissionIndicatorStatus {
  DRAFT = "DRAFT",
  ACCEPTED = "ACCEPTED",
  REVERTED = "REVERTED",
  RESUBMITTED = "RESUBMITTED",
  RETURNED_FROM_MOSPI = "RETURNED_FROM_MOSPI",
}

@Entity("ministry_submission_indicator")
@Index(["submissionId", "indicatorId"], { unique: true })
@Index(["ministryUser"])
@Index(["status"])
export class MinistrySubmissionIndicator {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "submission_id" })
  submissionId: string; // References ministry_submission.id

  @Column({ name: "indicator_id" })
  indicatorId: string; // References ministry_indicator_details.id

  @Column({
    name: "status",
    type: "enum",
    enum: SubmissionIndicatorStatus,
    nullable: true,
  })
  status: SubmissionIndicatorStatus | null;

  @Column({ name: "ministry_user", type: "varchar", length: 255, nullable: true })
  ministryUser: string | null;

  @Column({ name: "assigned_to", type: "varchar", length: 255, nullable: true })
  assignedTo: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}

