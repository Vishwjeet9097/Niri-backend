import { Controller, Get, UseGuards, Request, Param } from "@nestjs/common";
import { UserService } from "./user.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";
import { UserRole } from "../../entities/user.entity";

@Controller("user-indicators")
@UseGuards(JwtAuthGuard)
export class UserIndicatorsController {
  constructor(private readonly userService: UserService) {}

  // Simple endpoint for NODAL_OFFICER to get their assigned indicators
  @Get("my-assigned")
  @UseGuards(RolesGuard)
  @Roles(UserRole.NODAL_OFFICER)
  async getMyIndicators(@Request() req) {
    const userIndicatorScopes = await this.userService.getUserIndicatorScopes(
      req.user.id
    );
    return {
      status: true,
      data: userIndicatorScopes,
      message: "Your assigned indicators retrieved successfully",
    };
  }

  // Admin endpoint to get any user's indicators
  @Get("user/:userId")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER,
    UserRole.NODAL_OFFICER
  )
  async getUserIndicators(@Param("userId") userId: string, @Request() req) {
    const userIndicatorScopes =
      await this.userService.getUserIndicatorScopes(userId);
    return {
      status: true,
      data: userIndicatorScopes,
      message: "User indicators retrieved successfully",
    };
  }
}
