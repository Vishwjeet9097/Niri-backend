import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { MinistryFormSubmissionService } from './ministry.form.submission.service';
import { SubmitMinistryDataDto } from './dto/submit-ministry-data.dto';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';

@Controller('ministry/form/submission')
@UseGuards(JwtAuthGuard)
export class MinistryFormSubmissionController {
  constructor(private readonly ministryFormSubmissionService: MinistryFormSubmissionService) {}

  @Post('data')
  @HttpCode(HttpStatus.CREATED)
  async submitMinistryData(@Body() dto: SubmitMinistryDataDto) {
    return this.ministryFormSubmissionService.submitMinistryData(dto);
  }
}
