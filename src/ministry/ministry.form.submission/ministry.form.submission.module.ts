import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MinistryFormSubmissionService } from './ministry.form.submission.service';
import { MinistryFormSubmissionController } from './ministry.form.submission.controller';
import { MinistrySubmissionIndicator } from '../entities/ministry-submission-indicator.entity';
import { MinistrySubmission } from '../entities/ministry-submission.entity';
import { IndicatorDetail } from '../entities/indicator-detail.entity';
import { IndicatorSubsection } from '../entities/indicator-subsection.entity';
import { InputField } from '../entities/input-field.entity';
import { MinistrySubmissionData } from '../entities/ministry-submission-data.entity';
import { Form } from '../entities/form.entity';
import { MinistrySubmissionComment } from '../entities/ministry-submission-comment.entity';
import { User } from '../../entities/user.entity';
import { MinistryScoringModule } from '../../modules/ministry-scoring/ministry-scoring.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MinistrySubmissionIndicator,
      MinistrySubmission,
      IndicatorDetail,
      IndicatorSubsection,
      InputField,
      MinistrySubmissionData,
      Form,
      MinistrySubmissionComment,
      User,
    ]),
    MinistryScoringModule,
  ],
  controllers: [MinistryFormSubmissionController],
  providers: [MinistryFormSubmissionService],
  exports: [MinistryFormSubmissionService],
})
export class MinistryFormSubmissionModule {}
