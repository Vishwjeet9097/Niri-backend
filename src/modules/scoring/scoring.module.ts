import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Submission } from '../../entities/submission.entity';
import { FinalScore } from '../../entities/final-score.entity';
import { ScoringService } from './scoring.service';
import { ScoringController } from './scoring.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Submission, FinalScore])],
  controllers: [ScoringController],
  providers: [ScoringService],
  exports: [ScoringService],
})
export class ScoringModule {}
