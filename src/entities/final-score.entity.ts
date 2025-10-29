import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Submission } from "./submission.entity";

@Entity("final_scores")
@Index(["stateUt"])
@Index(["totalScore"])
@Index(["createdAt"])
export class FinalScore {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  submissionId: string;

  @OneToOne(() => Submission)
  @JoinColumn({ name: "submissionId" })
  submission: Submission;

  @Column()
  stateUt: string;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  totalScore: number;

  @Column({ type: "decimal", precision: 5, scale: 2, nullable: true })
  percentage: number;

  @Column({ type: "jsonb" })
  scoreBreakdown: Record<string, any>;

  @Column({ type: "text" })
  calculationMethodology: string;

  @Column()
  approvedBy: string;

  @Column({ type: "jsonb", nullable: true })
  categoryScores: Record<string, any>;

  @Column({ type: "varchar", default: "2.0" })
  scoringVersion: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
