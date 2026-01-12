import { Controller, Get, Post, Param, Body, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { UserRole } from '../../entities/user.entity';
import { ManualScoreUpdateDto } from './dto/manual-score-update.dto';

@Controller('scoring')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScoringController {
  constructor(private readonly scoringService: ScoringService) {}

  @Get('rankings')
  @Roles(UserRole.NODAL_OFFICER, UserRole.STATE_APPROVER, UserRole.MOSPI_REVIEWER, UserRole.MOSPI_APPROVER, UserRole.ADMIN)
  async getRankings(@Request() req) {
    const rankings = await this.scoringService.getScoreRankings();
    return {
      status: true,
      data: rankings,
      message: 'Score rankings retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('statistics')
  @Roles(UserRole.NODAL_OFFICER, UserRole.STATE_APPROVER, UserRole.MOSPI_REVIEWER, UserRole.MOSPI_APPROVER, UserRole.ADMIN)
  async getStatistics(@Request() req) {
    const statistics = await this.scoringService.getScoreStatistics();
    return {
      status: true,
      data: statistics,
      message: 'Score statistics retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('state/:stateUt')
  @Roles(UserRole.NODAL_OFFICER, UserRole.STATE_APPROVER, UserRole.MOSPI_REVIEWER, UserRole.MOSPI_APPROVER, UserRole.ADMIN)
  async getStateScore(@Param('stateUt') stateUt: string, @Request() req) {
    const score = await this.scoringService.getStateScore(stateUt);
    return {
      status: true,
      data: score,
      message: score ? 'State score retrieved successfully' : 'No score found for this state',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('calculate/:submissionId')
  @Roles(UserRole.MOSPI_APPROVER)
  async calculateScore(@Param('submissionId') submissionId: string, @Request() req) {
    // Clean the submissionId parameter (remove any colon prefix)
    const cleanSubmissionId = submissionId.startsWith(':')
      ? submissionId.substring(1)
      : submissionId;

    const score = await this.scoringService.calculateScore(cleanSubmissionId, req.user.id);
    return {
      status: true,
      data: score,
      message: 'Score calculated successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('diagnostics')
  @Roles(UserRole.MOSPI_APPROVER, UserRole.ADMIN)
  async getDiagnostics(@Request() req) {
    const diagnostics = await this.scoringService.getDiagnostics();
    return {
      status: true,
      data: diagnostics,
      message: 'Diagnostics retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('calculate-missing')
  @Roles(UserRole.MOSPI_APPROVER, UserRole.ADMIN)
  async calculateMissingScores(@Request() req) {
    const result = await this.scoringService.calculateMissingScores(req.user.id);
    return {
      status: true,
      data: result,
      message: `Calculated ${result.calculated} scores, ${result.failed} failed`,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('history/:submissionId')
  @Roles(UserRole.NODAL_OFFICER, UserRole.STATE_APPROVER, UserRole.MOSPI_REVIEWER, UserRole.MOSPI_APPROVER, UserRole.ADMIN)
  async getSubmissionScoreHistory(@Param('submissionId') submissionId: string, @Request() req) {
    const history = await this.scoringService.getSubmissionScoreHistory(submissionId);
    return {
      status: true,
      data: history,
      message: 'Score history retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('history/:submissionId/indicator/:indicatorCode')
  @Roles(UserRole.NODAL_OFFICER, UserRole.STATE_APPROVER, UserRole.MOSPI_REVIEWER, UserRole.MOSPI_APPROVER, UserRole.ADMIN)
  async getIndicatorScoreHistory(
    @Param('submissionId') submissionId: string,
    @Param('indicatorCode') indicatorCode: string,
    @Request() req
  ) {
    const history = await this.scoringService.getIndicatorScoreHistory(submissionId, indicatorCode);
    return {
      status: true,
      data: history,
      message: 'Indicator score history retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('history/:submissionId/grouped')
  @Roles(UserRole.NODAL_OFFICER, UserRole.STATE_APPROVER, UserRole.MOSPI_REVIEWER, UserRole.MOSPI_APPROVER, UserRole.ADMIN)
  async getScoreHistoryGrouped(@Param('submissionId') submissionId: string, @Request() req) {
    const groupedHistory = await this.scoringService.getScoreHistoryGroupedByIndicator(submissionId);
    return {
      status: true,
      data: groupedHistory,
      message: 'Grouped score history retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('indicator-scores/:submissionId')
  @Roles(UserRole.NODAL_OFFICER, UserRole.STATE_APPROVER, UserRole.MOSPI_REVIEWER, UserRole.MOSPI_APPROVER, UserRole.ADMIN)
  async getIndicatorScores(@Param('submissionId') submissionId: string, @Request() req) {
    const scores = await this.scoringService.getSubmissionIndicatorScores(submissionId);
    return {
      status: true,
      data: scores,
      message: 'Indicator scores retrieved successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('indicator-scores/:submissionId/:indicatorCode')
  @Roles(UserRole.NODAL_OFFICER, UserRole.STATE_APPROVER, UserRole.MOSPI_REVIEWER, UserRole.MOSPI_APPROVER, UserRole.ADMIN)
  async getIndicatorScore(
    @Param('submissionId') submissionId: string,
    @Param('indicatorCode') indicatorCode: string,
    @Request() req
  ) {
    const score = await this.scoringService.getIndicatorScore(submissionId, indicatorCode);
    return {
      status: true,
      data: score,
      message: score ? 'Indicator score retrieved successfully' : 'No score found for this indicator',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('manual-update')
  @Roles(UserRole.MOSPI_APPROVER)
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

      const manualUpdate = await this.scoringService.saveManualScoreUpdate(
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

  @Get('manual-update/:submissionId/:indicatorCode')
  @Roles(UserRole.MOSPI_APPROVER, UserRole.ADMIN)
  async getManualScoreUpdateHistory(
    @Param('submissionId') submissionId: string,
    @Param('indicatorCode') indicatorCode: string,
    @Request() req
  ) {
    const history = await this.scoringService.getManualScoreUpdateHistory(
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

  @Get('manual-update/:submissionId/:indicatorCode/latest')
  @Roles(UserRole.MOSPI_APPROVER, UserRole.ADMIN)
  async getLatestManualScoreUpdate(
    @Param('submissionId') submissionId: string,
    @Param('indicatorCode') indicatorCode: string,
    @Request() req
  ) {
    const latestUpdate = await this.scoringService.getLatestManualScoreUpdate(
      submissionId,
      indicatorCode
    );

    return {
      status: true,
      data: latestUpdate,
      message: latestUpdate 
        ? 'Latest manual score update retrieved successfully' 
        : 'No manual score update found',
      timestamp: new Date().toISOString(),
    };
  }
}