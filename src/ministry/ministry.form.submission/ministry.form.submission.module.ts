import { Module } from '@nestjs/common';
import { MinistryFormSubmissionService } from './ministry.form.submission.service';
import { MinistryFormSubmissionController } from './ministry.form.submission.controller';

@Module({
  controllers: [MinistryFormSubmissionController],
  providers: [MinistryFormSubmissionService],
})
export class MinistryFormSubmissionModule {}
