import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MinistryFormRetrieveService } from './ministry.form.retrieve.service';
import { MinistryFormRetrieveController } from './ministry.form.retrieve.controller';
import { MinistrySubmission } from '../entities/ministry-submission.entity';
import { MinistrySubmissionIndicator } from '../entities/ministry-submission-indicator.entity';
import { IndicatorDetail } from '../entities/indicator-detail.entity';
import { IndicatorSubsection } from '../entities/indicator-subsection.entity';
import { InputField } from '../entities/input-field.entity';
import { MinistrySubmissionData } from '../entities/ministry-submission-data.entity';
import { User } from '../../entities/user.entity';
import { Ministry } from '../../entities/ministry.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MinistrySubmission,
      MinistrySubmissionIndicator,
      IndicatorDetail,
      IndicatorSubsection,
      InputField,
      MinistrySubmissionData,
      User,
      Ministry,
    ]),
  ],
  controllers: [MinistryFormRetrieveController],
  providers: [MinistryFormRetrieveService],
  exports: [MinistryFormRetrieveService],
})
export class MinistryFormRetrieveModule {}
