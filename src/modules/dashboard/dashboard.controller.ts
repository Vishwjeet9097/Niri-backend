import { Controller, Get, UseGuards, Request } from "@nestjs/common";
import { DashboardService } from "./dashboard.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";
import { UserRole } from "../../entities/user.entity";

@Controller("dashboard")
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("summary")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.NODAL_OFFICER,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER,
    UserRole.ADMIN
  )
  async getSummary(@Request() req) {
    return this.dashboardService.getDashboardSummary(
      req.user.role,
      req.user.stateUt
    );
  }

  @Get("kpis")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.NODAL_OFFICER,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER,
    UserRole.ADMIN
  )
  async getKPIs(@Request() req) {
    return this.dashboardService.getRoleSpecificKPIs(
      req.user.role,
      req.user.stateUt
    );
  }

  @Get("recent-activities")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.NODAL_OFFICER,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER,
    UserRole.ADMIN
  )
  async getRecentActivities(@Request() req) {
    return this.dashboardService.getRecentActivities(
      req.user.role,
      req.user.stateUt
    );
  }
}
