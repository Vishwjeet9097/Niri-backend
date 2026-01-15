import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("ministry_submission_comment")
@Index(["submissionIndicatorId"])
@Index(["userId"])
export class MinistrySubmissionComment {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "submission_indicator_id" })
  submissionIndicatorId: string; // References ministry_submission_indicator.id

  @Column({ name: "user_id" })
  userId: string; // References users.id

  @Column({ type: "text" })
  text: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}

