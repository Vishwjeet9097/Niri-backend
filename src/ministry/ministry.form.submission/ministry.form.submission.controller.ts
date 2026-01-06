import { Controller, Post, Put, Body, HttpCode, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { MinistryFormSubmissionService } from './ministry.form.submission.service';
import { SubmitMinistryDataDto } from './dto/submit-ministry-data.dto';
import { UpdateSubmissionIndicatorStatusDto } from './dto/update-submission-indicator-status.dto';
import { UpdateFormStatusDto } from './dto/update-form-status.dto';
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

  @Put('indicator/status')
  @HttpCode(HttpStatus.OK)
  async updateSubmissionIndicatorStatus(@Body() dto: UpdateSubmissionIndicatorStatusDto) {
    return this.ministryFormSubmissionService.updateSubmissionIndicatorStatus(dto);
  }

  @Put('form/status')
  @HttpCode(HttpStatus.OK)
  async updateFormStatus(@Body() dto: UpdateFormStatusDto, @Request() req) {
    return this.ministryFormSubmissionService.updateFormStatus(
      dto,
      req.user.id,
      req.user.role,
    );
  }
}
