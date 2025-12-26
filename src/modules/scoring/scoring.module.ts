import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Submission } from '../../entities/submission.entity';
import { FinalScore } from '../../entities/final-score.entity';
import { IndicatorScore } from '../../entities/indicator-score.entity';
import { IndicatorScoreHistory } from '../../entities/indicator-score-history.entity';
import { ScoringService } from './scoring.service';
import { ScoringController } from './scoring.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Submission, FinalScore, IndicatorScore, IndicatorScoreHistory])],
  controllers: [ScoringController],
  providers: [ScoringService],
  exports: [ScoringService],
})
export class ScoringModule {}
