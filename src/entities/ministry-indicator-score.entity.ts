import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('ministry_indicator_scores')
@Index(['submissionId', 'indicatorCode'], { unique: true })
@Index(['submissionId'])
export class MinistryIndicatorScore {
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

  @Column({ name: 'calculation', type: 'jsonb' })
  calculation: {
    indicator: string;
    value: number;
    weight: number;
    score: number;
    maxScore: number;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

