import { Controller, Post, Put, Get, Delete, Body, Param, HttpCode, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { MinistryFormSubmissionService } from './ministry.form.submission.service';
import { SubmitMinistryDataDto } from './dto/submit-ministry-data.dto';
import { UpdateSubmissionIndicatorStatusDto } from './dto/update-submission-indicator-status.dto';
import { UpdateFormStatusDto } from './dto/update-form-status.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { DeleteSubmissionDataDto } from './dto/delete-submission-data.dto';
import { MospiFormActionDto, MospiFormAction } from './dto/mospi-form-action.dto';
import { DeleteFileDataDto } from './dto/delete-file-data.dto';
import { UserRole } from '../../entities/user.entity';
import { BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../modules/auth/guards/roles.guard';

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

  @Delete('data')
  @HttpCode(HttpStatus.OK)
  async deleteSubmissionData(@Body() dto: DeleteSubmissionDataDto) {
    return this.ministryFormSubmissionService.deleteSubmissionData(dto);
  }

  @Put('mospi-form-submit')
  @HttpCode(HttpStatus.OK)
  async mospiFormSubmit(@Body() dto: MospiFormActionDto, @Request() req) {
    const userRole = req.user.role;
    const { action } = dto;

    // Route based on user role and action
    if (userRole === UserRole.MOSPI_APPROVER) {
      if (action === MospiFormAction.SEND_BACK) {
        return this.ministryFormSubmissionService.mospiApproverSendBack(dto, req.user.id);
      } else if (action === MospiFormAction.ACCEPT) {
        return this.ministryFormSubmissionService.mospiApproverAccept(dto, req.user.id);
      } else {
        throw new BadRequestException(
          `Action '${action}' is not allowed for MOSPI_APPROVER. Allowed actions: send-back, accept`,
        );
      }
    } else if (userRole === UserRole.MOSPI_REVIEWER) {
      if (action === MospiFormAction.SUBMIT_TO_APPROVER) {
        return this.ministryFormSubmissionService.mospiReviewerSubmitToApprover(dto, req.user.id);
      } else {
        throw new BadRequestException(
          `Action '${action}' is not allowed for MOSPI_REVIEWER. Allowed action: submit-to-approver`,
        );
      }
    } else {
      throw new BadRequestException(
        `MOSPI form submission is not allowed for role: ${userRole}. Allowed roles: MOSPI_APPROVER, MOSPI_REVIEWER`,
      );
    }
  }

  @Delete('file-data')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MINISTRY_APPROVER)
  @HttpCode(HttpStatus.OK)
  async deleteFileData(@Body() dto: DeleteFileDataDto) {
    return this.ministryFormSubmissionService.deleteFileData(dto);
  }

  @Get('form-status-statistics/:formId')
  // @UseGuards(RolesGuard)
  // @Roles(UserRole.MOSPI_APPROVER)
  async getFormStatusStatistics(@Param('formId') formId: string) {
    return this.ministryFormSubmissionService.getFormStatusStatistics(formId);
  }
}
