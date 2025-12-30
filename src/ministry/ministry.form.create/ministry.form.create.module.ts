import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MinistryFormCreateService } from './ministry.form.create.service';
import { MinistryFormCreateController } from './ministry.form.create.controller';
import { IndicatorDetail } from '../entities/indicator-detail.entity';
import { IndicatorSubsection } from '../entities/indicator-subsection.entity';
import { InputField } from '../entities/input-field.entity';
import { Indicator } from '../../entities/indicator.entity';
import { UserIndicatorScope } from '../../entities/user-indicator-scope.entity';
import { Form } from '../entities/form.entity';
import { MinistrySubmission } from '../entities/ministry-submission.entity';
import { MinistrySubmissionIndicator } from '../entities/ministry-submission-indicator.entity';
import { User } from '../../entities/user.entity';
import { Ministry } from '../../entities/ministry.entity';

@Module({
  imports: [TypeOrmModule.forFeature([
    IndicatorDetail, 
    IndicatorSubsection, 
    InputField, 
    Indicator, 
    UserIndicatorScope,
    Form,
    MinistrySubmission,
    MinistrySubmissionIndicator,
    User,
    Ministry
  ])],
  controllers: [MinistryFormCreateController],
  providers: [MinistryFormCreateService],
  exports: [MinistryFormCreateService],
})
export class MinistryFormCreateModule {}
