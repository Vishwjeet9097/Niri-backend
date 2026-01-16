import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MinistrySubmission } from '../../ministry/entities/ministry-submission.entity';
import { MinistrySubmissionIndicator } from '../../ministry/entities/ministry-submission-indicator.entity';
import { MinistrySubmissionData } from '../../ministry/entities/ministry-submission-data.entity';
import { IndicatorDetail } from '../../ministry/entities/indicator-detail.entity';
import { InputField } from '../../ministry/entities/input-field.entity';
import { MinistryScoringService } from './ministry-scoring.service';
import { MinistryScoringController } from './ministry-scoring.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MinistrySubmission,
      MinistrySubmissionIndicator,
      MinistrySubmissionData,
      IndicatorDetail,
      InputField,
    ]),
  ],
  controllers: [MinistryScoringController],
  providers: [MinistryScoringService],
  exports: [MinistryScoringService],
})
export class MinistryScoringModule {}

