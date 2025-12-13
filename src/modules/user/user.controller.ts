import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  Put,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { UserService } from "./user.service";
import { IndicatorService } from "../indicator/indicator.service";
import { UpdateUserDto, CreateUserDto } from "../auth/dto/auth.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";
import { UserRole } from "../../entities/user.entity";

@Controller("users")
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly indicatorService: IndicatorService
  ) {}

  // Get all users by each role with isActive=true
  @Get("all/active-by-role")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER
  )
  async getAllActiveUsersByRole(@Request() req) {
    // Only privileged roles can access
    const usersByRole = await this.userService.getAllActiveUsersByRole();
    return {
      status: true,
      data: usersByRole,
      message: "Active users grouped by role retrieved successfully",
    };
  }

  @Get()
  async findAll(@Request() req) {
    const users = await this.userService.findAll(
      req.user.role,
      req.user.stateUt,
      req.user.id
    );
    return {
      status: true,
      data: users,
      message: "Users retrieved successfully",
    };
  }

  @Get("by-state/:stateUt")
  async getUsersByState(@Param("stateUt") stateUt: string, @Request() req) {
    const users = await this.userService.getUsersByState(
      stateUt,
      req.user.role,
      req.user.stateUt,
      req.user.id
    );
    return {
      status: true,
      data: users,
      message: "Users retrieved successfully",
    };
  }

  @Get("by-role/:role")
  async getUsersByRole(
    @Param("role") role: UserRole,
    @Request() req,
    @Query("stateUt") stateUt?: string
  ) {
    const users = await this.userService.getUsersByRole(
      role,
      stateUt,
      req.user.role,
      req.user.stateUt,
      req.user.id
    );
    return {
      status: true,
      data: users,
      message: "Users retrieved successfully",
    };
  }

  // Simple endpoint for NODAL_OFFICER to get their assigned indicators
  @Get("my-indicators")
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

  // Indicator-related endpoints (must be before :id route)
  @Get(":id/indicators")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.NODAL_OFFICER,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER
  )
  async getUserIndicators(@Param("id") id: string, @Request() req) {
    // Check if user can access this user's data
    if (req.user.id !== id && req.user.role === UserRole.NODAL_OFFICER) {
      throw new Error("Access denied");
    }

    // Get user's assigned indicators from user_indicator_scope table
    const userIndicatorScopes =
      await this.userService.getUserIndicatorScopes(id);
    return {
      status: true,
      data: userIndicatorScopes,
      message: "User indicators retrieved successfully",
    };
  }

  @Post(":id/indicators")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER
  )
  async assignIndicatorsToUser(
    @Param("id") id: string,
    @Body() body: { indicatorCodes: string[] },
    @Request() req
  ) {
    return this.indicatorService.assignIndicatorsToUser(
      id,
      body.indicatorCodes
    );
  }

  @Put(":id/indicators")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER
  )
  async updateUserIndicators(
    @Param("id") id: string,
    @Body() body: { indicatorCodes: string[] },
    @Request() req
  ) {
    return this.indicatorService.assignIndicatorsToUser(
      id,
      body.indicatorCodes
    );
  }

  @Delete(":id/indicators")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER
  )
  async removeIndicatorsFromUser(
    @Param("id") id: string,
    @Body() body: { indicatorCodes: string[] },
    @Request() req
  ) {
    return this.indicatorService.removeIndicatorsFromUser(
      id,
      body.indicatorCodes
    );
  }

  @Get(":id/indicator-scope")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.NODAL_OFFICER,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER
  )
  async getUserIndicatorScope(@Param("id") id: string, @Request() req) {
    // Check if user can access this user's data
    if (req.user.id !== id && req.user.role === UserRole.NODAL_OFFICER) {
      throw new Error("Access denied");
    }
    return this.indicatorService.getUserIndicators(id);
  }

  @Put(":id/indicator-scope")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER
  )
  async updateUserIndicatorScope(
    @Param("id") id: string,
    @Body() body: { indicatorCodes: string[] },
    @Request() req
  ) {
    return this.indicatorService.assignIndicatorsToUser(
      id,
      body.indicatorCodes
    );
  }

  @Get(":id/indicator-access")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.NODAL_OFFICER,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER
  )
  async getUserIndicatorAccess(@Param("id") id: string, @Request() req) {
    // Check if user can access this user's data
    if (req.user.id !== id && req.user.role === UserRole.NODAL_OFFICER) {
      throw new Error("Access denied");
    }
    const indicators = await this.indicatorService.getUserIndicators(id);
    return {
      userId: id,
      indicators: indicators.map((ind) => ({
        id: ind.id,
        code: ind.code,
        name: ind.name,
        category: ind.category,
        maxScore: ind.maxScore,
      })),
      totalIndicators: indicators.length,
    };
  }

  @Post("create")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER
  )
  async createUser(@Body() createUserDto: CreateUserDto, @Request() req) {
    return this.userService.createUser(
      createUserDto,
      req.user.role,
      req.user.stateUt
    );
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER
  )
  async update(
    @Param("id") id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req
  ) {
    const effectiveStateUt = updateUserDto.stateUt?.length
      ? updateUserDto.stateUt
      : req.user.stateUt;

    return this.userService.update(
      id,
      updateUserDto,
      req.user.role,
      //req.user.stateUt
      effectiveStateUt
    );
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER
  )
  async deactivate(@Param("id") id: string, @Request() req) {
    await this.userService.deactivate(id, req.user.role, req.user.stateUt);
    return { message: "User deleted successfully" };
  }

  @Delete("bulk/delete")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER
  )
  async bulkDeactivate(
    @Body() bulkDeleteDto: { userIds: string[] },
    @Request() req
  ) {
    const result = await this.userService.bulkDeactivate(
      bulkDeleteDto.userIds,
      req.user.role,
      req.user.stateUt
    );
    return {
      message: `Successfully deactivated ${result.successCount} users`,
      details: result,
    };
  }

  // Move :id route to the very end to avoid conflicts with other routes
  @Get(":id")
  async findOne(@Param("id") id: string, @Request() req) {
    const user = await this.userService.findOne(id, req.user.role, req.user.stateUt);
    return {
      status: true,
      data: user,
      message: "User retrieved successfully",
    };
  }

  //Restrict for state assigned users

  @Get("states/assigned-state-by-state-approver/:roleName")
  @UseGuards(RolesGuard)
  async assignedStateByState(
    @Param("roleName") roleName: UserRole,
    @Request() req
  ) {
    return this.userService.assignedStateByStateApprover(roleName);
  }

  /**
   * TESTING ONLY: Delete all users by role endpoint
   * Deletes all users with the specified role along with their related data
   * WARNING: This is a destructive operation for testing purposes only!
   */
  @Delete("by-role/:role")
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async deleteUsersByRole(
    @Param("role") role: UserRole,
    @Request() req
  ) {
    return this.userService.deleteUsersByRole(role);
  }

  @Get("check-email/:email")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER
  )
  async checkEmailAvailability(
    @Param("email") email: string,
    @Query("excludeUserId") excludeUserId?: string
  ) {
    const isAvailable = await this.userService.checkEmailAvailability(
      email,
      excludeUserId
    );
    return {
      status: true,
      data: { available: isAvailable },
      message: isAvailable
        ? "Email is available"
        : "Email already exists",
    };
  }

  @Get("check-contact/:contactNumber")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER
  )
  async checkContactAvailability(
    @Param("contactNumber") contactNumber: string,
    @Query("excludeUserId") excludeUserId?: string
  ) {
    const isAvailable = await this.userService.checkContactAvailability(
      contactNumber,
      excludeUserId
    );
    return {
      status: true,
      data: { available: isAvailable },
      message: isAvailable
        ? "Contact number is available"
        : "Contact number already exists",
    };
  }
}
