import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";
import { IndicatorService } from "./indicator.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";
import { UserRole } from "../../entities/user.entity";

@Controller("indicators")
@UseGuards(JwtAuthGuard)
export class IndicatorController {
  constructor(private readonly indicatorService: IndicatorService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.NODAL_OFFICER,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER
  )
  async findAll() {
    return this.indicatorService.findAll();
  }

  @Get("my-assigned")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.NODAL_OFFICER,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER
  )
  async getMyAssignedIndicators(@Request() req) {
    const userIndicatorScopes =
      await this.indicatorService.getUserIndicatorScopes(req.user.id);
    return {
      status: true,
      data: userIndicatorScopes,
      message: "Your assigned indicators retrieved successfully",
    };
  }

  @Get(":id")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.NODAL_OFFICER,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER
  )
  async findOne(@Param("id") id: string) {
    return this.indicatorService.findOne(id);
  }

  @Get("section/:sectionId")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.NODAL_OFFICER,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER
  )
  async findBySection(@Param("sectionId") sectionId: string) {
    return this.indicatorService.findBySection(sectionId);
  }

  @Get("category/:category")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.NODAL_OFFICER,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER
  )
  async findByCategory(@Param("category") category: string) {
    return this.indicatorService.findByCategory(category);
  }

  @Get("search")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.NODAL_OFFICER,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER
  )
  async search(
    @Query("q") query: string,
    @Query("category") category?: string,
    @Query("isActive") isActive?: boolean
  ) {
    return this.indicatorService.search(query, category, isActive);
  }

  @Get("active")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.NODAL_OFFICER,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER
  )
  async getActiveIndicators() {
    return this.indicatorService.findAll();
  }

  @Get("statistics")
  @UseGuards(RolesGuard)
  @Roles(UserRole.MOSPI_APPROVER, UserRole.MOSPI_REVIEWER)
  async getStatistics() {
    return this.indicatorService.getIndicatorStatistics();
  }

  @Get("usage-report")
  @UseGuards(RolesGuard)
  @Roles(UserRole.MOSPI_APPROVER, UserRole.MOSPI_REVIEWER)
  async getUsageReport() {
    return this.indicatorService.getUsageReport();
  }
}
