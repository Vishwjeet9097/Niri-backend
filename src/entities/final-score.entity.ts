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

  @Column({ name: 'submissionId' })
  submissionId: string;

  @OneToOne(() => Submission)
  @JoinColumn({ name: 'submissionId' })
  submission: Submission;

  @Column({ name: 'stateUt' })
  stateUt: string;

  @Column({ name: 'totalScore', type: 'decimal', precision: 10, scale: 2 })
  totalScore: number;

  @Column({ name: 'percentage', type: 'decimal', precision: 5, scale: 2, nullable: true })
  percentage: number;

  @Column({ name: 'scoreBreakdown', type: 'jsonb' })
  scoreBreakdown: Record<string, any>;

  @Column({ name: 'calculationMethodology', type: 'text' })
  calculationMethodology: string;

  @Column({ name: 'approvedBy' })
  approvedBy: string;

  @Column({ name: 'categoryScores', type: 'jsonb', nullable: true })
  categoryScores: Record<string, any>;

  @Column({ name: 'scoringVersion', type: 'varchar', default: '2.0' })
  scoringVersion: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
