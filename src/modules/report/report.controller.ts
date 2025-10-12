import { Controller, Get, Param, Query, UseGuards, Request, Res } from '@nestjs/common';
import { Response } from 'express';
import { ReportService } from './report.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { UserRole } from '../../entities/user.entity';

@Controller('report')
@UseGuards(JwtAuthGuard)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('ranking')
  async getRankings() {
    return this.reportService.getRankings();
  }

  @Get('full-report')
  async getFullReport() {
    return this.reportService.getReportData();
  }

  @Get('state/:stateUt')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STATE_APPROVER, UserRole.MOSPI_REVIEWER, UserRole.MOSPI_APPROVER)
  async getStateReport(@Param('stateUt') stateUt: string, @Request() req) {
    // State approvers can only access their own state report
    if (req.user.role === UserRole.STATE_APPROVER && req.user.stateUt !== stateUt) {
      throw new Error('Access denied');
    }

    return this.reportService.getStateReport(stateUt);
  }

  @Get('export')
  async exportRankings(@Query('format') format: 'json' | 'csv' = 'json', @Res() res: Response) {
    const data = await this.reportService.exportRankings(format);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=niri-rankings.csv');
      res.send(data);
    } else {
      res.json(data);
    }
  }

  @Get('submission-status')
  async getSubmissionStatusReport() {
    return this.reportService.getSubmissionStatusReport();
  }
}
