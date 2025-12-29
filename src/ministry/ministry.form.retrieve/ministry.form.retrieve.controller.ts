import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { MinistryFormRetrieveService } from './ministry.form.retrieve.service';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';

@Controller('ministry/form/retrieve')
@UseGuards(JwtAuthGuard)
export class MinistryFormRetrieveController {
  constructor(
    private readonly ministryFormRetrieveService: MinistryFormRetrieveService,
  ) {}

  @Get('submission/:submissionId')
  async getSubmissionDetails(@Param('submissionId') submissionId: string) {
    return this.ministryFormRetrieveService.getSubmissionDetails(submissionId);
  }
}
