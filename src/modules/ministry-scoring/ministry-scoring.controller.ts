import { Controller, Get, Post, Param, Body, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { MinistryScoringService } from './ministry-scoring.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { UserRole } from '../../entities/user.entity';
import { ManualScoreUpdateDto } from '../scoring/dto/manual-score-update.dto';

@Controller('scoring/ministry')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MinistryScoringController {
  constructor(private readonly ministryScoringService: MinistryScoringService) {}

  @Get('rankings')
  @Roles(
    UserRole.MINISTRY_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER,
    UserRole.ADMIN
  )
  async getRankings(@Request() req) {
    const rankings = await this.ministryScoringService.getMinistryScoreRankings();
    return {
      status: true,
      data: rankings,
      message: 'Ministry score rankings retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('statistics')
  @Roles(
    UserRole.MINISTRY_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER,
    UserRole.ADMIN
  )
  async getStatistics(@Request() req) {
    const statistics = await this.ministryScoringService.getMinistryScoreStatistics();
    return {
      status: true,
      data: statistics,
      message: 'Ministry score statistics retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':submissionId')
  @Roles(
    UserRole.MINISTRY_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER,
    UserRole.ADMIN
  )
  async getMinistryScore(@Param('submissionId') submissionId: string, @Request() req) {
    const score = await this.ministryScoringService.calculateScore(submissionId, req.user.id);
    return {
      status: true,
      data: score,
      message: 'Ministry score calculated successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('calculate/:submissionId')
  @Roles(
    UserRole.MOSPI_APPROVER,
    UserRole.ADMIN
  )
  async calculateScore(@Param('submissionId') submissionId: string, @Request() req) {
    const score = await this.ministryScoringService.calculateScore(submissionId, req.user.id);
    return {
      status: true,
      data: score,
      message: 'Ministry score calculated successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('indicator-scores/:submissionId')
  @Roles(
    UserRole.MINISTRY_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER,
    UserRole.ADMIN
  )
  async getIndicatorScores(@Param('submissionId') submissionId: string) {
    const scores = await this.ministryScoringService.getSubmissionIndicatorScores(submissionId);
    return {
      status: true,
      data: scores,
      message: 'Indicator scores retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('indicator-scores/:submissionId/:indicatorCode')
  @Roles(
    UserRole.MINISTRY_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER,
    UserRole.ADMIN
  )
  async getIndicatorScore(
    @Param('submissionId') submissionId: string,
    @Param('indicatorCode') indicatorCode: string
  ) {
    const score = await this.ministryScoringService.getIndicatorScore(submissionId, indicatorCode);
    
    // Ensure score values are properly formatted as numbers
    if (score) {
      score.score = typeof score.score === 'string' ? parseFloat(score.score) : score.score;
      score.maxScore = typeof score.maxScore === 'string' ? parseFloat(score.maxScore) : score.maxScore;
    }
    
    return {
      status: true,
      data: score,
      message: score ? 'Indicator score retrieved successfully' : 'No score found for this indicator',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('manual-update/:submissionId/:indicatorCode')
  @Roles(UserRole.MOSPI_APPROVER, UserRole.ADMIN)
  async getLatestManualScoreUpdate(
    @Param('submissionId') submissionId: string,
    @Param('indicatorCode') indicatorCode: string
  ) {
    const update = await this.ministryScoringService.getLatestManualScoreUpdate(submissionId, indicatorCode);
    return {
      status: true,
      data: update,
      message: update ? 'Manual score update retrieved successfully' : 'No manual update found',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('manual-update')
  @Roles(UserRole.MOSPI_APPROVER, UserRole.ADMIN)
  async saveManualScoreUpdate(
    @Body() dto: ManualScoreUpdateDto,
    @Request() req
  ) {
    try {
      // Additional validation: check if updated score exceeds max score
      if (dto.updatedScore > dto.maxScore) {
        throw new BadRequestException(
          `Updated score (${dto.updatedScore}) cannot exceed maximum score (${dto.maxScore})`
        );
      }

      const manualUpdate = await this.ministryScoringService.saveManualScoreUpdate(
        dto.submissionId,
        dto.indicatorCode,
        dto.category,
        dto.updatedScore,
        dto.maxScore,
        dto.updateReason,
        req.user.id
      );

      return {
        status: true,
        data: manualUpdate,
        message: 'Manual score update saved successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(error.message || 'Failed to save manual score update');
    }
  }

  @Get('manual-update-history/:submissionId/:indicatorCode')
  @Roles(UserRole.MOSPI_APPROVER, UserRole.ADMIN)
  async getManualScoreUpdateHistory(
    @Param('submissionId') submissionId: string,
    @Param('indicatorCode') indicatorCode: string
  ) {
    const history = await this.ministryScoringService.getManualScoreUpdateHistory(
      submissionId,
      indicatorCode
    );
    return {
      status: true,
      data: history,
      message: 'Manual score update history retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }
}

