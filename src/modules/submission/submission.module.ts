import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Submission } from '../../entities/submission.entity';
import { FinalScore } from '../../entities/final-score.entity';
import { SubmissionService } from './submission.service';
import { SubmissionController } from './submission.controller';
import { ScoringModule } from '../scoring/scoring.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Submission, FinalScore]),
    ScoringModule,
    StorageModule,
  ],
  controllers: [SubmissionController],
  providers: [SubmissionService],
  exports: [SubmissionService],
})
export class SubmissionModule {}
