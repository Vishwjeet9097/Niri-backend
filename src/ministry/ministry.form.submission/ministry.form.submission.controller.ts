import { Controller } from '@nestjs/common';
import { MinistryFormSubmissionService } from './ministry.form.submission.service';

@Controller('ministry.form.submission')
export class MinistryFormSubmissionController {
  constructor(private readonly ministryFormSubmissionService: MinistryFormSubmissionService) {}
}
