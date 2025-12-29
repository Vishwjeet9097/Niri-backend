import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("ministry_submission_indicator")
@Index(["submissionId", "indicatorId"], { unique: true })
export class MinistrySubmissionIndicator {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "submission_id" })
  submissionId: string; // References ministry_submission.id

  @Column({ name: "indicator_id" })
  indicatorId: string; // References ministry_indicator_details.id

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}

