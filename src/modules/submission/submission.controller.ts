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
  HttpCode,
  HttpStatus,
  BadRequestException,
  Put,
  UseInterceptors,
  UploadedFiles,
} from "@nestjs/common";
import { SubmissionService } from "./submission.service";
import {
  CreateSubmissionDto,
  UpdateSubmissionDto,
  AddCommentDto,
  ForwardToMoSPIDto,
  UpdateStatusDto,
  ForwardToMoSPIReviewerDto,
  ForwardToMoSPIApproverDto,
  SendBackToStateDto,
  StateRejectDto,
  FinalRejectDto,
  ResubmitDto,
  SubmissionQueryDto,
  SubmitWithSectionCommentsDto,
  SectionComment,
} from "./dto/submission.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard, Roles } from "../auth/guards/roles.guard";
import { UserRole } from "../../entities/user.entity";
import { SubmissionStatus } from "../../entities/submission.entity";
import { IndicatorAccessMiddleware } from "../../middleware/indicator-access.middleware";
import { AnyFilesInterceptor } from "@nestjs/platform-express";
@Controller("submission")
@UseGuards(JwtAuthGuard)
export class SubmissionController {
  constructor(private readonly submissionService: SubmissionService) {}

  // Testing endpoint for comment grouping
  @Get("test/comments/:id")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.NODAL_OFFICER,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER
  )
  async testCommentGrouping(@Param("id") id: string, @Request() req) {
    const submission = await this.submissionService.findOne(
      id,
      req.user.role,
      req.user.stateUt
    );

    // Create a response object with just the comments
    const response = {
      id: submission.id,
      status: submission.status,
      reviewComments: submission.reviewComments,
      commentsBySection: {},
    };

    // Group comments by section if they exist
    if (
      submission.reviewComments &&
      Array.isArray(submission.reviewComments) &&
      submission.reviewComments.length > 0
    ) {
      response.commentsBySection =
        this.submissionService.groupCommentsBySection(
          submission.reviewComments
        );
    }

    return response;
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.NODAL_OFFICER)
  @UseGuards(IndicatorAccessMiddleware)
  @UseInterceptors(AnyFilesInterceptor())
  async create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body("submission") submission: string,
    @Request() req
  ) {
    if (!submission) {
      throw new BadRequestException("Missing submission JSON in form-data.");
    }

    // Parse submission JSON
    let parsedSubmission: CreateSubmissionDto;
    try {
      parsedSubmission = JSON.parse(submission);
    } catch (error) {
      throw new BadRequestException("Invalid submission JSON format.");
    }

    // ✅ Map uploaded files to nested fields (like infraEnablers.section4_2.file)
    if (files?.length) {
      for (const file of files) {
        const fieldPath = file.fieldname.split("."); // e.g. ["infraEnablers", "section4_2", "file"]
        let current = parsedSubmission.formData;

        for (let i = 0; i < fieldPath.length - 1; i++) {
          const key = fieldPath[i];
          if (!current[key]) current[key] = {};
          current = current[key];
        }

        const lastKey = fieldPath[fieldPath.length - 1];

        // Upload file using your existing storage service (S3/local)
        const storedFile = await this.submissionService.uploadFile(file, {
          submissionId: parsedSubmission.submissionId,
          path: fieldPath.slice(1).join("/"), // skip the first part if it's "submissions"
        });

        current[lastKey] = storedFile.fileUrl; // ✅ replace the base64 with actual S3 URL
      }
    }

    // ✅ Create submission in DB
    return this.submissionService.create(
      parsedSubmission,
      req.user.id,
      req.user.role,
      req.user.stateUt
    );
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.NODAL_OFFICER,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER,
    UserRole.ADMIN
  )
  async findAll(@Query() queryDto: any, @Request() req) {
    // Manual validation for status parameter
    if (queryDto.status) {
      const statusArray = queryDto.status
        .split(",")
        .map((s: string) => s.trim());
      const validStatuses = [
        "DRAFT",
        "SUBMITTED_TO_STATE",
        "SUBMITTED_TO_MOSPI_REVIEWER",
        "SUBMITTED_TO_MOSPI_APPROVER",
        "REJECTED",
        "REJECTED_FINAL",
        "RETURNED_FROM_STATE",
        "RETURNED_FROM_MOSPI",
        "APPROVED",
      ];
      const invalidStatuses = statusArray.filter(
        (status) => !validStatuses.includes(status)
      );

      if (invalidStatuses.length > 0) {
        throw new BadRequestException(
          `Invalid status values: ${invalidStatuses.join(", ")}`
        );
      }
    }

    return this.submissionService.findAll(
      queryDto,
      req.user.role,
      req.user.stateUt,
      req.user.id
    );
  }

  @Get("debug/all")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.NODAL_OFFICER,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER
  )
  async debugFindAll(@Request() req) {
    // Debug endpoint - returns all submissions without any filters
    const query = this.submissionService["submissionRepository"]
      .createQueryBuilder("submission")
      .leftJoinAndSelect("submission.user", "user")
      .leftJoinAndSelect("submission.finalScore", "finalScore")
      .orderBy("submission.createdAt", "DESC");

    const [submissions, total] = await query.getManyAndCount();

    return {
      status: true,
      data: {
        submissions,
        total,
        userInfo: {
          role: req.user.role,
          stateUt: req.user.stateUt,
          userId: req.user.id,
        },
      },
      message: "Debug: All submissions retrieved without filters",
      timestamp: new Date().toISOString(),
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
  async findOne(@Param("id") id: string, @Request() req) {
    const submission = await this.submissionService.findOne(
      id,
      req.user.role,
      req.user.stateUt
    );

    // Group comments by section for the response
    if (
      submission.reviewComments &&
      Array.isArray(submission.reviewComments) &&
      submission.reviewComments.length > 0
    ) {
      const originalComments = [...submission.reviewComments];
      // We need to preserve the original array in the database but transform it for the response
      const groupedComments =
        this.submissionService.groupCommentsBySection(originalComments);

      // Add the grouped comments as a separate property to avoid type conflicts
      submission["commentsBySection"] = groupedComments;
    }

    return submission;
  }

  @Put(":id")
  @UseGuards(RolesGuard)
  @Roles(UserRole.NODAL_OFFICER)
  @UseGuards(IndicatorAccessMiddleware)
  async update(
    @Param("id") id: string,
    @Body() updateSubmissionDto: UpdateSubmissionDto,
    @Request() req
  ) {
    return this.submissionService.update(
      id,
      updateSubmissionDto,
      req.user.id,
      req.user.role,
      req.user.stateUt
    );
  }

  @Post(":id/comment")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.NODAL_OFFICER,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER,
    UserRole.ADMIN
  )
  async addComment(
    @Param("id") id: string,
    @Body() addCommentDto: AddCommentDto,
    @Request() req
  ) {
    return this.submissionService.addComment(
      id,
      addCommentDto,
      req.user.id,
      req.user.role,
      req.user.stateUt
    );
  }

  @Get(":id/indicator-comments")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.NODAL_OFFICER,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER,
    UserRole.ADMIN
  )
  async getIndicatorComments(@Param("id") id: string, @Request() req) {
    return this.submissionService.getIndicatorComments(
      id,
      req.user.role,
      req.user.stateUt
    );
  }

  @Post("update-status/:id")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.NODAL_OFFICER,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER
  )
  @HttpCode(HttpStatus.OK)
  async updateStatus(
    @Param("id") id: string,
    @Body() updateStatusDto: UpdateStatusDto,
    @Request() req
  ) {
    return this.submissionService.updateStatus(
      id,
      updateStatusDto,
      req.user.id,
      req.user.role,
      req.user.stateUt
    );
  }

  @Post("forward-to-mospi-reviewer/:id")
  @UseGuards(RolesGuard)
  @Roles(UserRole.STATE_APPROVER)
  @HttpCode(HttpStatus.OK)
  async forwardToMoSPIReviewer(
    @Param("id") id: string,
    @Body() forwardDto: ForwardToMoSPIReviewerDto,
    @Request() req
  ) {
    return this.submissionService.forwardToMoSPIReviewer(
      id,
      forwardDto,
      req.user.id,
      req.user.role,
      req.user.stateUt
    );
  }

  @Post("forward-to-mospi-approver/:id")
  @UseGuards(RolesGuard)
  @Roles(UserRole.MOSPI_REVIEWER)
  @HttpCode(HttpStatus.OK)
  async forwardToMoSPIApprover(
    @Param("id") id: string,
    @Body() forwardDto: ForwardToMoSPIApproverDto,
    @Request() req
  ) {
    return this.submissionService.forwardToMoSPIApprover(
      id,
      forwardDto,
      req.user.id,
      req.user.role,
      req.user.stateUt
    );
  }

  @Post("send-back-to-state/:id")
  @UseGuards(RolesGuard)
  @Roles(UserRole.MOSPI_REVIEWER, UserRole.MOSPI_APPROVER)
  @HttpCode(HttpStatus.OK)
  async sendBackToState(
    @Param("id") id: string,
    @Body() sendBackDto: SendBackToStateDto,
    @Request() req
  ) {
    return this.submissionService.sendBackToState(
      id,
      sendBackDto,
      req.user.id,
      req.user.role,
      req.user.stateUt
    );
  }

  @Post("forward-to-mospi/:id")
  @UseGuards(RolesGuard)
  @Roles(UserRole.STATE_APPROVER)
  @HttpCode(HttpStatus.OK)
  async forwardToMoSPI(
    @Param("id") id: string,
    @Body() forwardDto: ForwardToMoSPIDto,
    @Request() req
  ) {
    return this.submissionService.forwardToMoSPI(
      id,
      forwardDto,
      req.user.id,
      req.user.role,
      req.user.stateUt
    );
  }

  @Post("state-reject/:id")
  @UseGuards(RolesGuard)
  @Roles(UserRole.STATE_APPROVER, UserRole.MOSPI_APPROVER)
  @HttpCode(HttpStatus.OK)
  async stateReject(
    @Param("id") id: string,
    @Body() rejectDto: StateRejectDto,
    @Request() req
  ) {
    return this.submissionService.stateReject(
      id,
      rejectDto,
      req.user.id,
      req.user.role,
      req.user.stateUt
    );
  }

  @Post("final-reject/:id")
  @UseGuards(RolesGuard)
  @Roles(UserRole.MOSPI_APPROVER, UserRole.STATE_APPROVER)
  @HttpCode(HttpStatus.OK)
  async finalReject(
    @Param("id") id: string,
    @Body() rejectDto: FinalRejectDto,
    @Request() req
  ) {
    return this.submissionService.finalReject(
      id,
      rejectDto,
      req.user.id,
      req.user.role,
      req.user.stateUt
    );
  }

  @Post("resubmit/:id")
  @UseGuards(RolesGuard)
  @Roles(UserRole.NODAL_OFFICER, UserRole.STATE_APPROVER)
  @HttpCode(HttpStatus.OK)
  async resubmit(
    @Param("id") id: string,
    @Body() resubmitDto: ResubmitDto,
    @Request() req
  ) {
    return this.submissionService.resubmit(
      id,
      resubmitDto,
      req.user.id,
      req.user.role,
      req.user.stateUt
    );
  }

  @Post("submit-to-state/:id")
  @UseGuards(RolesGuard)
  @Roles(UserRole.NODAL_OFFICER)
  @HttpCode(HttpStatus.OK)
  async submitToState(@Param("id") id: string, @Request() req) {
    return this.submissionService.submitToState(
      id,
      req.user.id,
      req.user.role,
      req.user.stateUt
    );
  }

  @Post("submit-with-comments/:id")
  @UseGuards(RolesGuard)
  @Roles(UserRole.NODAL_OFFICER)
  @HttpCode(HttpStatus.OK)
  async submitWithSectionComments(
    @Param("id") id: string,
    @Body() submitDto: SubmitWithSectionCommentsDto,
    @Request() req
  ) {
    return this.submissionService.submitWithSectionComments(
      id,
      submitDto,
      req.user.id,
      req.user.role,
      req.user.stateUt
    );
  }

  @Post("approve/:id")
  @UseGuards(RolesGuard)
  @Roles(UserRole.MOSPI_APPROVER)
  @HttpCode(HttpStatus.OK)
  async approve(
    @Param("id") id: string,
    @Body() approveDto: { status: SubmissionStatus; comment?: string },
    @Request() req
  ) {
    return this.submissionService.approve(
      id,
      approveDto,
      req.user.id,
      req.user.role,
      req.user.stateUt
    );
  }
}
