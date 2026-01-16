import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common';
import { MinistryScoringService } from './ministry-scoring.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { UserRole } from '../../entities/user.entity';

@Controller('scoring/ministry')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MinistryScoringController {
  constructor(private readonly ministryScoringService: MinistryScoringService) {}

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
}

