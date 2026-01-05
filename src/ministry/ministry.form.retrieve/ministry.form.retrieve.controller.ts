import {
  Controller,
  Get,
  Param,
  Query,
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

  @Get('submission/:userId')
  async getSubmissionDetails(@Param('userId') userId: string) {
    return this.ministryFormRetrieveService.getSubmissionDetails(userId);
  }

  @Get('submission-with-data/:userId')
  async getSubmissionDetailsWithData(
    @Param('userId') userId: string,
    @Query('forReview') forReview?: string,
  ) {
    const forReviewBool = forReview === 'true';
    return this.ministryFormRetrieveService.getSubmissionDetailsWithData(userId, forReviewBool);
  }
}
