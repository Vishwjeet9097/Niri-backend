import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MinistryDashboardController } from './ministry.dashboard.controller';
import { MinistryDashboardService } from './ministry.dashboard.service';
import { MinistrySubmissionIndicator } from '../entities/ministry-submission-indicator.entity';
import { MinistrySubmission } from '../entities/ministry-submission.entity';
import { Form } from '../entities/form.entity';
import { User } from '../../entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MinistrySubmissionIndicator,
      MinistrySubmission,
      Form,
      User,
    ]),
  ],
  controllers: [MinistryDashboardController],
  providers: [MinistryDashboardService],
  exports: [MinistryDashboardService],
})
export class MinistryDashboardModule {}

