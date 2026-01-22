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
import { MinistrySubmission } from '../ministry/entities/ministry-submission.entity';

@Entity('ministry_final_scores')
@Index(['ministryId'])
@Index(['totalScore'])
@Index(['createdAt'])
export class MinistryFinalScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'submissionId', type: 'uuid' })
  submissionId: string; // References ministry_submission.id (UUID)

  @OneToOne(() => MinistrySubmission)
  @JoinColumn({ name: 'submissionId' })
  submission: MinistrySubmission;

  @Column({ name: 'ministryId' })
  ministryId: string; // Ministry identifier

  @Column({ name: 'totalScore', type: 'decimal', precision: 10, scale: 2 })
  totalScore: number;

  @Column({ name: 'percentage', type: 'decimal', precision: 5, scale: 2, nullable: true })
  percentage: number;

  @Column({ name: 'scoreBreakdown', type: 'jsonb' })
  scoreBreakdown: Record<string, any>;

  @Column({ name: 'calculationMethodology', type: 'text' })
  calculationMethodology: string;

  @Column({ name: 'approvedBy' })
  approvedBy: string; // User ID who approved the score

  @Column({ name: 'categoryScores', type: 'jsonb', nullable: true })
  categoryScores: Record<string, any>;

  @Column({ name: 'scoringVersion', type: 'varchar', default: '1.0' })
  scoringVersion: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

