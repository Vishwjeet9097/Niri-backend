import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { UserRole } from '../../entities/user.entity';

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
}