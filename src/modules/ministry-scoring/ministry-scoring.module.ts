import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MinistrySubmission } from '../../ministry/entities/ministry-submission.entity';
import { MinistrySubmissionIndicator } from '../../ministry/entities/ministry-submission-indicator.entity';
import { MinistrySubmissionData } from '../../ministry/entities/ministry-submission-data.entity';
import { IndicatorDetail } from '../../ministry/entities/indicator-detail.entity';
import { IndicatorSubsection } from '../../ministry/entities/indicator-subsection.entity';
import { InputField } from '../../ministry/entities/input-field.entity';
import { MinistryIndicatorScore } from '../../entities/ministry-indicator-score.entity';
import { MinistryIndicatorScoreHistory } from '../../entities/ministry-indicator-score-history.entity';
import { MinistryFinalScore } from '../../entities/ministry-final-score.entity';
import { MinistryManualScoreUpdate } from '../../entities/ministry-manual-score-update.entity';
import { Ministry } from '../../entities/ministry.entity';
import { MinistryScoringService } from './ministry-scoring.service';
import { MinistryScoringController } from './ministry-scoring.controller';
import { MinistryScoringSubscriber } from './ministry-scoring.subscriber';
import { MinistryIndicatorScoringSubscriber } from './ministry-indicator-scoring.subscriber';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MinistrySubmission,
      MinistrySubmissionIndicator,
      MinistrySubmissionData,
      IndicatorDetail,
      IndicatorSubsection,
      InputField,
      MinistryIndicatorScore,
      MinistryIndicatorScoreHistory,
      MinistryFinalScore,
      MinistryManualScoreUpdate,
      Ministry,
    ]),
  ],
  controllers: [MinistryScoringController],
  providers: [
    MinistryScoringService,
    MinistryScoringSubscriber,
    MinistryIndicatorScoringSubscriber,
  ],
  exports: [MinistryScoringService],
})
export class MinistryScoringModule {}

