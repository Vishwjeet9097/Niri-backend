import { Controller, Post, Put, Get, Body, Param, HttpCode, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { MinistryFormSubmissionService } from './ministry.form.submission.service';
import { SubmitMinistryDataDto } from './dto/submit-ministry-data.dto';
import { UpdateSubmissionIndicatorStatusDto } from './dto/update-submission-indicator-status.dto';
import { UpdateFormStatusDto } from './dto/update-form-status.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
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

  @Put('data')
  @HttpCode(HttpStatus.OK)
  async updateMinistryData(@Body() dto: SubmitMinistryDataDto) {
    return this.ministryFormSubmissionService.updateMinistryData(dto);
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

  @Post('comment')
  @HttpCode(HttpStatus.CREATED)
  async createComment(@Body() dto: CreateCommentDto, @Request() req) {
    return this.ministryFormSubmissionService.createComment(dto, req.user.id);
  }

  @Get('comment/:submissionIndicatorId')
  async getCommentsBySubmissionIndicator(@Param('submissionIndicatorId') submissionIndicatorId: string) {
    return this.ministryFormSubmissionService.getCommentsBySubmissionIndicator(submissionIndicatorId);
  }
}
