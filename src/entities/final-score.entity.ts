import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Submission } from './submission.entity';

@Entity('final_scores')
@Index(['stateUt'])
@Index(['totalScore'])
@Index(['createdAt'])
export class FinalScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'submission_id' })
  submissionId: string;

  @OneToOne(() => Submission)
  @JoinColumn({ name: 'submission_id' })
  submission: Submission;

  @Column({ name: 'state_ut' })
  stateUt: string;

  @Column({ name: 'total_score', type: 'decimal', precision: 10, scale: 2 })
  totalScore: number;

  @Column({ name: 'score_breakdown', type: 'jsonb' })
  scoreBreakdown: Record<string, any>;

  @Column({ name: 'calculation_methodology', type: 'text' })
  calculationMethodology: string;

  @Column({ name: 'approved_by' })
  approvedBy: string;

  @Column({ name: 'category_scores', type: 'jsonb', nullable: true })
  categoryScores: Record<string, number>;

  @Column({ name: 'scoring_version', type: 'varchar', default: '2.0' })
  scoringVersion: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
