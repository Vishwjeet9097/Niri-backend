import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('ministry_manual_score_updates')
@Index(['submissionId', 'indicatorCode'])
@Index(['submissionId'])
@Index(['indicatorCode'])
@Index(['createdAt'])
export class MinistryManualScoreUpdate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'submissionId', type: 'uuid' })
  submissionId: string; // References ministry_submission.id (UUID)

  @Column({ name: 'indicatorCode' })
  indicatorCode: string; // e.g., "1.1", "2.3", etc.

  @Column({ name: 'category' })
  category: string; // e.g., "infraFinancing", "infraDevelopment", etc.

  @Column({ name: 'systemScore', type: 'decimal', precision: 10, scale: 2 })
  systemScore: number; // The original system-generated score at time of manual update

  @Column({ name: 'manualUpdatedScore', type: 'decimal', precision: 10, scale: 2 })
  manualUpdatedScore: number; // The manually entered score

  @Column({ name: 'maxScore', type: 'decimal', precision: 10, scale: 2 })
  maxScore: number;

  @Column({ name: 'updateReason', type: 'text' })
  updateReason: string; // User's reason for update

  @Column({ name: 'updatedBy', type: 'uuid' })
  updatedBy: string; // User ID who made the manual update

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date; // Timestamp of the manual update
}

