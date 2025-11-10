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
    UserRole.MOSPI_APPROVER
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
    UserRole.MOSPI_APPROVER
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
    UserRole.MOSPI_APPROVER
  )
  async getRecentActivities(@Request() req) {
    return this.dashboardService.getRecentActivities(
      req.user.role,
      req.user.stateUt
    );
  }

  @Get("state-approver")
  @UseGuards(RolesGuard)
  @Roles(UserRole.STATE_APPROVER)
  async getStateApproverDashboard(@Request() req) {
    return this.dashboardService.getStateApproverDashboardCounts(
      req.user.role,
      req.user.stateUt
    );
  }

  // inside DashboardController class
@Get("nodal-metrics")
@UseGuards(RolesGuard)
@Roles(UserRole.NODAL_OFFICER)
async getNodalMetrics(@Request() req) {
  // req.user.id must be present (JWT middleware)
  return this.dashboardService.getNodalOfficerDashboardCounts(req.user.id);
}
}
