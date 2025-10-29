import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToOne,
} from "typeorm";
import { User, UserRole } from "./user.entity";
import { FinalScore } from "./final-score.entity";

export enum SubmissionStatus {
  DRAFT = "DRAFT",
  SUBMITTED_TO_STATE = "SUBMITTED_TO_STATE",
  SUBMITTED_TO_MOSPI_REVIEWER = "SUBMITTED_TO_MOSPI_REVIEWER",
  SUBMITTED_TO_MOSPI_APPROVER = "SUBMITTED_TO_MOSPI_APPROVER",
  REJECTED = "REJECTED",
  REJECTED_FINAL = "REJECTED_FINAL",
  RETURNED_FROM_STATE = "RETURNED_FROM_STATE",
  RETURNED_FROM_MOSPI = "RETURNED_FROM_MOSPI",
  APPROVED = "APPROVED",
}

export interface ReviewComment {
  timestamp: Date;
  role: UserRole;
  userId: string;
  userName: string; // User's full name (firstName + lastName)
  text: string;
  type: "comment" | "rejection" | "approval" | "indicator_comment";
  sectionId: string; // Section ID is now required for all comments
}

export interface SubmissionFile {
  fileName: string;
  originalName: string;
  filePath: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
}

@Entity("submissions")
@Index(["stateUt"])
@Index(["status"])
@Index(["submittedBy"])
@Index(["currentOwnerRole"])
export class Submission {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "submissionId", unique: true })
  submissionId: string;

  @Column()
  stateUt: string;

  @Column()
  submittedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "submittedBy" })
  user: User;

  @Column({ default: 0 })
  rejectionCount: number;

  @Column({ type: "jsonb", nullable: true })
  formData: any;

  @Column({
    type: "jsonb",
    default: () => "'[]'",
  })
  reviewComments: ReviewComment[];

  @Column({
    type: "jsonb",
    default: () => "'{}'",
  })
  indicatorComment: Record<string, ReviewComment[]>;

  @Column({ type: "jsonb", nullable: true, default: () => "'[]'::jsonb" })
  attachedFiles: any;
  // attachedFiles: SubmissionFile[];

  @Column({
    type: "enum",
    enum: SubmissionStatus,
    default: SubmissionStatus.SUBMITTED_TO_STATE,
  })
  status: SubmissionStatus;

  @Column({
    type: "enum",
    enum: UserRole,
    default: UserRole.STATE_APPROVER,
  })
  currentOwnerRole: UserRole;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => FinalScore, (finalScore) => finalScore.submission)
  finalScore: FinalScore;
}
