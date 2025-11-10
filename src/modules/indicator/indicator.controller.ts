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
  Req,
} from "@nestjs/common";
import { IndicatorService } from "./indicator.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";
import { UserRole } from "../../entities/user.entity";

@Controller("indicators")
@UseGuards(JwtAuthGuard)
export class IndicatorController {
  constructor(private readonly indicatorService: IndicatorService) {}

  @Get("state-approver/indicators")
  @UseGuards(RolesGuard)
  @Roles(UserRole.STATE_APPROVER)
  async getStateApproverIndicators(@Request() req) {
    try {
      if (!req.user?.stateUt) {
        return {
          status: false,
          message: 'No state/UT assigned to the current user',
          data: null
        };
      }

      const indicators = await this.indicatorService.getIndicatorsByState(req.user.stateUt);
      return {
        status: true,
        data: indicators,
        message: `Indicators for your state (${req.user.stateUt}) fetched successfully`,
      };
    } catch (error) {
      return {
        status: false,
        message: error.message || 'Error fetching state indicators',
      };
    }
  }

  @Get("available-for-approver")
  @UseGuards(RolesGuard)
  @Roles(UserRole.STATE_APPROVER)
  async getAvailableForApprover(
    @Request() req,
    @Query("stateUt") stateUt?: string
  ) {
    const user: any = (req as any).user || {};
    const targetState = stateUt || user.stateUt;
    return this.indicatorService.getAvailableIndicatorsForApprover(
      targetState,
      user.sub || user.id
    );
  }

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


  @Get('status')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.NODAL_OFFICER,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER
  )
  async getIndicatorStatus(
    @Query('submissionId') submissionId: string,
    @Query('parentKey') parentKey: string,
    @Query('sectionKey') sectionKey: string,
    @Query('field') field: string
  ) {
    try {
      const result = await this.indicatorService.getIndicatorStatusFromSubmission(submissionId, parentKey, sectionKey, field);
      return {
        status: true,
        data: result,
        message: 'Indicator status fetched successfully',
      };
    } catch (error) {
      return {
        status: false,
        message: error.message || 'Error fetching indicator status',
      };
    }
  }

  /**
   * API to fetch all indicators with a specific status from submission formData
   * GET /indicators/by-status?submissionId=...&status=...
   */
  @Get('by-status')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.NODAL_OFFICER,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER
  )
  async getIndicatorsByStatus(
    @Query('submissionId') submissionId: string,
    @Query('status') status: string
  ) {
    try {
      const result = await this.indicatorService.getIndicatorsByStatus(submissionId, status);
      return {
        status: true,
        data: result,
        message: 'Indicators fetched successfully',
      };
    } catch (error) {
      return {
        status: false,
        message: error.message || 'Error fetching indicators',
      };
    }
  }

  /**
   * API to fetch indicator statuses from all nodal officers in state approver's state
   * GET /indicators/state-statuses
   */
  // @Get('state-statuses')
  // @UseGuards(RolesGuard)
  // @Roles(UserRole.STATE_APPROVER)
  // async getStateIndicatorStatuses(@Request() req, @Query('year') year?: string) {
  //   try {
  //     const result = await this.indicatorService.getStateIndicatorStatuses(req.user.id, year);
  //     return {
  //       status: true,
  //       data: result,
  //       message: 'State indicator statuses fetched successfully',
  //     };
  //   } catch (error) {
  //     return {
  //       status: false,
  //       message: error.message || 'Error fetching state indicator statuses',
  //     };
  //   }
  // }

  // indicator.controller.ts
@Get('state-statuses')
 @UseGuards(RolesGuard)
 @Roles(UserRole.STATE_APPROVER)
async stateStatuses(
  @Req() req: Request & { user?: { id: string } },
  @Query('year') year?: string
) {
  // assuming req.user.id is your logged-in State Approver
  const data = await this.indicatorService.getStateIndicatorStatuses(req.user.id, year);
  return {
    status: true,
    message: 'State indicator statuses fetched successfully',
    data, // contains { stateUt, submissions, summary: { acceptedCount, totalIndicators, ... } }
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
