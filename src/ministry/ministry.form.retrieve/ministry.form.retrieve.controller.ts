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
    const result = await this.ministryFormRetrieveService.getSubmissionDetails(userId);
    // Ensure submissionId is included
    console.log('[Controller] getSubmissionDetails returning:', {
      hasSubmissionId: !!result?.submissionId,
      submissionId: result?.submissionId,
      resultKeys: result ? Object.keys(result) : 'null'
    });
    return result;
  }
  
  @Get('submission-id-from-indicator/:submissionIndicatorId')
  async getSubmissionIdFromIndicator(@Param('submissionIndicatorId') submissionIndicatorId: string) {
    return this.ministryFormRetrieveService.getSubmissionIdFromIndicator(submissionIndicatorId);
  }

  @Get('submission-with-data/:userId')
  async getSubmissionDetailsWithData(
    @Param('userId') userId: string,
    @Query('forReview') forReview?: string,
  ) {
    const forReviewBool = forReview === 'true';
    const result = await this.ministryFormRetrieveService.getSubmissionDetailsWithData(userId, forReviewBool);
    
    // CRITICAL: Log to verify submissionId is in the result
    console.log('[Controller] Service returned result:', {
      hasSubmissionId: !!result?.submissionId,
      submissionId: result?.submissionId,
      resultKeys: result ? Object.keys(result) : 'null',
      resultType: typeof result
    });
    
    // Ensure submissionId is explicitly included
    const response = {
      ...result,
      submissionId: result?.submissionId || null, // Explicitly include submissionId
    };
    
    console.log('[Controller] Final response being sent:', {
      hasSubmissionId: !!response.submissionId,
      submissionId: response.submissionId,
      responseKeys: Object.keys(response)
    });
    
    return response;
  }
}
