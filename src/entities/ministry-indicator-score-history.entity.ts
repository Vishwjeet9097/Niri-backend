import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('ministry_indicator_score_history')
@Index(['submissionId', 'indicatorCode'])
@Index(['submissionId'])
@Index(['indicatorCode'])
@Index(['createdAt'])
export class MinistryIndicatorScoreHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'submissionId', type: 'uuid' })
  submissionId: string; // References ministry_submission.id (UUID)

  @Column({ name: 'indicatorCode' })
  indicatorCode: string; // e.g., "1.1", "2.3", etc.

  @Column({ name: 'category' })
  category: string; // e.g., "infraFinancing", "infraDevelopment", etc.

  @Column({ name: 'score', type: 'decimal', precision: 10, scale: 2 })
  score: number;

  @Column({ name: 'maxScore', type: 'decimal', precision: 10, scale: 2 })
  maxScore: number;

  @Column({ name: 'previousScore', type: 'decimal', precision: 10, scale: 2, nullable: true })
  previousScore: number | null; // Previous score before this update

  @Column({ name: 'scoreChange', type: 'decimal', precision: 10, scale: 2, nullable: true })
  scoreChange: number | null; // Difference from previous score

  @Column({ name: 'calculation', type: 'jsonb' })
  calculation: {
    indicator: string;
    value: number;
    weight: number;
    score: number;
    maxScore: number;
  };

  @Column({ name: 'formDataSnapshot', type: 'jsonb', nullable: true })
  formDataSnapshot: Record<string, any> | null; // Snapshot of formData at this point

  @Column({ name: 'updatedBy', nullable: true })
  updatedBy: string | null; // User ID who triggered this update

  @Column({ name: 'updateReason', nullable: true })
  updateReason: string | null; // e.g., "INDICATOR_SUBMITTED", "INDICATOR_RESUBMITTED", "INDICATOR_UPDATED"

  @Column({ name: 'indicatorStatus', nullable: true })
  indicatorStatus: string | null; // Status at time of update (e.g., "SUBMITTED_TO_MINISTRY", "RESUBMITTED")

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date; // Timestamp of this score update
}

