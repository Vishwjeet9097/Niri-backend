import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { MinistryDashboardService } from './ministry.dashboard.service';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';

@Controller('ministry/dashboard')
@UseGuards(JwtAuthGuard)
export class MinistryDashboardController {
  constructor(
    private readonly ministryDashboardService: MinistryDashboardService,
  ) {}

  @Get('progress/:ministryUserId')
  async getProgressBarData(@Param('ministryUserId') ministryUserId: string) {
    return this.ministryDashboardService.getProgressBarData(ministryUserId);
  }

  @Get(':userId')
  async getDashboardData(@Param('userId') userId: string) {
    return this.ministryDashboardService.getDashboardData(userId);
  }
}

