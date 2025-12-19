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
  @UseGuards(RolesGuard, IndicatorAccessMiddleware)
  @Roles(UserRole.NODAL_OFFICER, UserRole.STATE_APPROVER)
  @UseInterceptors(AnyFilesInterceptor())
  async create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body("submission") submission: string,
    @Request() req
  ) {
    if (!submission) {
      throw new BadRequestException("Missing submission JSON in form-data.");
    }

    // Parse JSON
    let parsedSubmission: CreateSubmissionDto;
    try {
      parsedSubmission = JSON.parse(submission);
    } catch {
      throw new BadRequestException("Invalid submission JSON format.");
    }
    // make sure formData and attachedFiles exist so pushes won't crash
    parsedSubmission.formData = parsedSubmission.formData || {};
    parsedSubmission.attachedFiles = parsedSubmission.attachedFiles || [];

    // Auto-generate submissionId if not provided, or if it's a UUID or invalid format
    // UUIDs have format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (36 chars with hyphens)
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUUID = parsedSubmission.submissionId && uuidPattern.test(parsedSubmission.submissionId);
    const isValidFormat = parsedSubmission.submissionId && parsedSubmission.submissionId.startsWith('SUB-');
    
    if (!parsedSubmission.submissionId || isUUID || !isValidFormat) {
      const year = new Date().getFullYear();
      const randomNum = Math.floor(Math.random() * 1000000)
        .toString()
        .padStart(6, "0");
      parsedSubmission.submissionId = `SUB-${year}-${randomNum}`;
      if (isUUID || !isValidFormat) {
        console.log(`⚠️ Invalid submissionId detected (UUID or invalid format). Generated new submissionId: ${parsedSubmission.submissionId}`);
      }
    }

    // Map files to nested fields
    if (files?.length) {
      for (const file of files) {
        const fieldPath = file.fieldname
          .replace(/\[(\d+)\]/g, ".$1") // handle arrays
          .split(".");

        let current = parsedSubmission.formData;
        for (let i = 0; i < fieldPath.length - 1; i++) {
          const key = fieldPath[i];
          // If current[key] exists but is a string, convert it to an object
          if (typeof current[key] === "string") {
            current[key] = { existingFilePath: current[key] };
          }
          if (!current[key]) {
            const nextKey = fieldPath[i + 1];
            current[key] = /^\d+$/.test(nextKey) ? [] : {};
          }
          current = current[key];
        }

        const lastKey = fieldPath[fieldPath.length - 1];

        const storedFile = await this.submissionService.uploadFile(file, {
          submissionId: parsedSubmission.submissionId,
          path: fieldPath.slice(1).join("/"),
        });

        // Build normalized uploadedAt string
        const uploadedAtStr =
          storedFile.uploadedAt instanceof Date
            ? storedFile.uploadedAt.toISOString()
            : String(storedFile.uploadedAt || new Date().toISOString());

        // Build full metadata object
        const fileMeta = {
          id: (storedFile as any).id ?? null,
          fileName: storedFile.fileName || file.originalname || "",
          originalName: storedFile.originalName || file.originalname || "",
          filePath: storedFile.filePath || "",
          fileUrl: storedFile.fileUrl ?? "",
          fileSize: storedFile.fileSize ?? file.size ?? 0,
          mimeType: storedFile.mimeType || file.mimetype || "",
          uploadedAt: uploadedAtStr,
        };

        // Store minimal reference in formData (for UI reference - only filePath needed)
        // Full metadata goes to attachedFiles column
        current[lastKey] = {
          id: fileMeta.id,
          filePath: fileMeta.filePath,
          fileName: fileMeta.fileName,
        };

        // Add full metadata to attachedFiles array (stored in separate column)
        parsedSubmission.attachedFiles.push({
          fileName: fileMeta.fileName,
          originalName: fileMeta.originalName,
          filePath: fileMeta.filePath,
          fileUrl: fileMeta.fileUrl,
          fileSize: fileMeta.fileSize,
          mimeType: fileMeta.mimeType,
          uploadedAt: fileMeta.uploadedAt,
        });
      }
    }

    // Save in DB
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
    UserRole.MOSPI_APPROVER
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

    // sectionStatus removed; just return submission
    return submission;
  }

  @Get(":id/status")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.NODAL_OFFICER,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER
  )
  async getSubmissionStatus(@Param("id") id: string, @Request() req) {
    const submission = await this.submissionService.findOne(
      id,
      req.user.role,
      req.user.stateUt
    );

    // sectionStatus removed; just return minimal status
    return {
      status: true,
      data: {
        submissionId: submission.id,
      },
      message: "Submission status retrieved successfully",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("user/:userId")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.NODAL_OFFICER,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER,
    UserRole.ADMIN
  )
  async findByUser(@Param("userId") userId: string, @Request() req) {
    const submission = await this.submissionService.findByUser(
      userId,
      req.user.role,
      req.user.stateUt
    );

    if (!submission) {
      return { message: "No submission found for this user", data: null };
    }

    return { message: "Submission found", data: submission };
  }
  @Put(":id")
  @UseGuards(RolesGuard)
  @Roles(UserRole.NODAL_OFFICER)
  @UseGuards(IndicatorAccessMiddleware)
  @UseInterceptors(AnyFilesInterceptor())
  async update(
    @Param("id") id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body("submission") submission: string,
    @Request() req
  ) {
    // Handle both multipart/form-data and JSON body
    let updateSubmissionDto: UpdateSubmissionDto;

    if (submission) {
      // Multipart form-data case
      try {
        updateSubmissionDto = JSON.parse(submission);
      } catch {
        throw new BadRequestException("Invalid submission JSON format.");
      }
    } else if (req.body && typeof req.body === "object") {
      // Regular JSON body case
      updateSubmissionDto = req.body as UpdateSubmissionDto;
    } else {
      throw new BadRequestException("Missing submission data.");
    }

    updateSubmissionDto.formData = updateSubmissionDto.formData || {};

    // Fetch submission to get the submissionId field (not the DB UUID id)
    const existingSubmission = await this.submissionService.findOne(
      id,
      req.user.role,
      req.user.stateUt
    );
    const submissionIdForFiles = existingSubmission.submissionId;

    // Handle file uploads if present
    if (files?.length) {
      for (const file of files) {
        const fieldPath = file.fieldname
          .replace(/\[(\d+)\]/g, ".$1")
          .split(".");

        let current = updateSubmissionDto.formData;
        for (let i = 0; i < fieldPath.length - 1; i++) {
          const key = fieldPath[i];
          if (typeof current[key] === "string") {
            current[key] = { existingFilePath: current[key] };
          }
          if (!current[key]) {
            const nextKey = fieldPath[i + 1];
            current[key] = /^\d+$/.test(nextKey) ? [] : {};
          }
          current = current[key];
        }

        const lastKey = fieldPath[fieldPath.length - 1];

        const storedFile = await this.submissionService.uploadFile(file, {
          submissionId: submissionIdForFiles,
          path: fieldPath.slice(1).join("/"),
        });

        const uploadedAtStr =
          storedFile.uploadedAt instanceof Date
            ? storedFile.uploadedAt.toISOString()
            : String(storedFile.uploadedAt || new Date().toISOString());

        const fileMeta = {
          id: (storedFile as any).id ?? null,
          fileName: storedFile.fileName || file.originalname || "",
          originalName: storedFile.originalName || file.originalname || "",
          filePath: storedFile.filePath || "",
          fileUrl: storedFile.fileUrl ?? "",
          fileSize: storedFile.fileSize ?? file.size ?? 0,
          mimeType: storedFile.mimeType || file.mimetype || "",
          uploadedAt: uploadedAtStr,
        };

        current[lastKey] = fileMeta;
      }
    }

    return this.submissionService.update(
      id,
      updateSubmissionDto,
      req.user.id,
      req.user.role,
      req.user.stateUt
    );
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles(UserRole.NODAL_OFFICER, UserRole.STATE_APPROVER)
  @UseGuards(IndicatorAccessMiddleware)
  @UseInterceptors(AnyFilesInterceptor())
  async patch(
    @Param("id") id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body("submission") submission: string,
    @Request() req
  ) {
    // Handle both multipart/form-data and JSON body

    let updateSubmissionDto: UpdateSubmissionDto;

    if (submission) {
      // Multipart form-data case
      try {
        updateSubmissionDto = JSON.parse(submission);
      } catch {
        throw new BadRequestException("Invalid submission JSON format.");
      }
    } else if (req.body && typeof req.body === "object") {
      // Regular JSON body case
      // Accept both wrapped (formData) and unwrapped payloads
      if (req.body.formData) {
        updateSubmissionDto = req.body as UpdateSubmissionDto;
      } else {
        updateSubmissionDto = { formData: req.body } as UpdateSubmissionDto;
      }
    } else {
      throw new BadRequestException("Missing submission data.");
    }

    // Always ensure formData is initialized for file upload logic
    updateSubmissionDto.formData = updateSubmissionDto.formData || {};

    // Fetch submission to get the submissionId field (not the DB UUID id)
    const existingSubmission = await this.submissionService.findOne(
      id,
      req.user.role,
      req.user.stateUt
    );
    const submissionIdForFiles = existingSubmission.submissionId;

    // Support section_status (snake_case) as alias for sectionStatus (camelCase)
    if ((updateSubmissionDto as any).section_status) {
      updateSubmissionDto.sectionStatus = (
        updateSubmissionDto as any
      ).section_status;
      delete (updateSubmissionDto as any).section_status;
    }

    // File upload handling - Build structure dynamically for new indicators (same as create)
    if (files?.length) {
      for (const file of files) {
        const fieldPath = file.fieldname
          .replace(/\[(\d+)\]/g, ".$1") // handle arrays
          .split(".");

        // Build nested structure if it doesn't exist (for new indicators)
        let current = updateSubmissionDto.formData;
        for (let i = 0; i < fieldPath.length - 1; i++) {
          const key = fieldPath[i];
          // If current[key] exists but is a string, convert it to an object
          if (typeof current[key] === "string") {
            current[key] = { existingFilePath: current[key] };
          }
          if (!current[key]) {
            const nextKey = fieldPath[i + 1];
            current[key] = /^\d+$/.test(nextKey) ? [] : {};
          }
          current = current[key];
        }

        const lastKey = fieldPath[fieldPath.length - 1];

        // Upload file to S3 via storageService.uploadFile()
        const storedFile = await this.submissionService.uploadFile(file, {
          submissionId: submissionIdForFiles,
          path: fieldPath.slice(1).join("/"),
        });

        // Build normalized uploadedAt string
        const uploadedAtStr =
          storedFile.uploadedAt instanceof Date
            ? storedFile.uploadedAt.toISOString()
            : String(storedFile.uploadedAt || new Date().toISOString());

        // Build full metadata object (store this in formData)
        const fileMeta = {
          id: (storedFile as any).id ?? null,
          fileName: storedFile.fileName || file.originalname || "",
          originalName: storedFile.originalName || file.originalname || "",
          filePath: storedFile.filePath || "",
          fileUrl: storedFile.fileUrl ?? "",
          fileSize: storedFile.fileSize ?? file.size ?? 0,
          mimeType: storedFile.mimeType || file.mimetype || "",
          uploadedAt: uploadedAtStr,
        };

        // Store file metadata in formData (for UI reference - only filePath needed)
        // Store minimal reference in formData, full metadata goes to attachedFiles
        current[lastKey] = {
          id: fileMeta.id,
          filePath: fileMeta.filePath,
          fileName: fileMeta.fileName,
        };

        // Initialize attachedFiles array if not present
        if (!updateSubmissionDto.attachedFiles) {
          updateSubmissionDto.attachedFiles = [];
        }

        // Add to attachedFiles array (store in separate column)
        updateSubmissionDto.attachedFiles.push({
          fileName: fileMeta.fileName,
          originalName: fileMeta.originalName,
          filePath: fileMeta.filePath,
          fileUrl: fileMeta.fileUrl,
          fileSize: fileMeta.fileSize,
          mimeType: fileMeta.mimeType,
          uploadedAt: fileMeta.uploadedAt,
        });
      }
    }

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

  @Post("mospi-approver-send-back/:id")
  @UseGuards(RolesGuard)
  @Roles(UserRole.MOSPI_APPROVER)
  @HttpCode(HttpStatus.OK)
  async mospiApproverSendBack(
    @Param("id") id: string,
    @Body() body: { comment?: string },
    @Request() req
  ) {
    return this.submissionService.mospiApproverSendBack(
      id,
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
  @UseInterceptors(AnyFilesInterceptor())
  @HttpCode(HttpStatus.OK)
  async resubmit(
    @Param("id") id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body("submission") submission: string,
    @Request() req
  ) {
    // यदि multipart में submission JSON नहीं मिला, तो सीधे JSON बॉडी सपोर्ट भी रखें
    if (!submission && req.body && typeof req.body === "object") {
      const fallbackDto = req.body as unknown as ResubmitDto;
      return this.submissionService.resubmit(
        id,
        fallbackDto,
        req.user.id,
        req.user.role,
        req.user.stateUt
      );
    }

    if (!submission) {
      // Header-based fallback (for misformatted multipart clients)
      const headerJson = req.headers?.["x-submission-json"] as
        | string
        | undefined;
      if (headerJson && typeof headerJson === "string") {
        submission = headerJson;
      } else {
        throw new BadRequestException("Missing submission JSON in form-data.");
      }
    }

    // Parse JSON to ResubmitDto-लाइक ऑब्जेक्ट
    let parsed: ResubmitDto & { submissionId?: string; attachedFiles?: any[] };
    try {
      parsed = JSON.parse(submission);
    } catch {
      throw new BadRequestException("Invalid submission JSON format.");
    }

    parsed.formData = parsed.formData || {};

    // खाली file ऑब्जेक्ट्स क्लीन करें
    this.cleanEmptyFileObjects(parsed.formData);

    // Fetch submission to get the submissionId field (not the DB UUID id)
    const existingSubmission = await this.submissionService.findOne(
      id,
      req.user.role,
      req.user.stateUt
    );
    const submissionIdForFiles = existingSubmission.submissionId;

    // फ़ाइलों को nested फील्ड्स पर मैप करें (create जैसा)
    if (files?.length) {
      for (const file of files) {
        const fieldPath = file.fieldname
          .replace(/\[(\d+)\]/g, ".$1")
          .split(".");

        let current: any = parsed.formData;
        for (let i = 0; i < fieldPath.length - 1; i++) {
          const key = fieldPath[i];
          if (!current[key]) {
            const nextKey = fieldPath[i + 1];
            current[key] = /^\d+$/.test(nextKey) ? [] : {};
          }
          current = current[key];
        }

        const lastKey = fieldPath[fieldPath.length - 1];

        const storedFile = await this.submissionService.uploadFile(file, {
          submissionId: submissionIdForFiles,
          path: fieldPath.slice(1).join("/"),
        });

        current[lastKey] = storedFile.filePath;
      }
    }

    // सर्विस को अपडेटेड formData/कमेंट्स के साथ कॉल करें
    const dto: ResubmitDto = {
      formData: parsed.formData,
      comment: (parsed as any).comment,
      sectionComments: (parsed as any).sectionComments,
    };

    return this.submissionService.resubmit(
      id,
      dto,
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

  // Helper method to clean empty file objects from formData
  private cleanEmptyFileObjects(obj: any): void {}

  //🧑‍💻🧑‍💻New API for completing the workflow
  // ...existing code...
  @Post("update-indicator")
  // @UseGuards(RolesGuard)
  // @Roles(UserRole.STATE_APPROVER)
  @HttpCode(HttpStatus.OK)
  async updateFormSection(
    @Body()
    body: {
      submissionId?: string;
      category?: string;
      section?: string;
      fields?: any[];
    },
    @Request() req
  ) {
    const { submissionId, category, section, fields } = body;

    if (!submissionId || !category || !section || !Array.isArray(fields)) {
      throw new BadRequestException(
        "Missing required fields: submission_id, category, section, fields[]"
      );
    }

    // Delegate to service
    return this.submissionService.updateFormSectionFields(
      submissionId,
      category,
      section,
      fields,
      req.user.id,
      req.user.role,
      req.user.stateUt
    );
  }
  // ...existing code...

  @Post("indicator-submission-status")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_APPROVER,
    UserRole.MOSPI_REVIEWER
  )
  @HttpCode(HttpStatus.OK)
  async indicatorSubmissionAccepted(
    @Body()
    body: {
      submissionId?: string;
      category?: string;
      section?: string;
      status?: boolean;
      mospi_status?: string;
      nodalOfficerId?: string; // Add this parameter
    },
    @Request() req
  ) {
    const { submissionId, category, section, status, mospi_status, nodalOfficerId } = body;
  
    if (!submissionId || !category || !section || typeof status !== "boolean") {
      throw new BadRequestException(
        "Missing required fields: submissionId, category, section, accepted"
      );
    }
  
    let fields: any = [];
    // Create fields array with status
    if (req.user.role === UserRole.STATE_APPROVER) {
      fields = [{ status: status ? "ACCEPTED" : "REVERTED" }];
    } else {
      fields = [{ mospi_status: mospi_status }];
    }
  
    // Reuse existing service method, pass nodalOfficerId
    return this.submissionService.updateFormSectionFields(
      submissionId,
      category,
      section,
      fields,
      req.user.id,
      req.user.role,
      req.user.stateUt,
      nodalOfficerId // Pass nodalOfficerId
    );
  }
  

  // --- cumulative preview for a state ---
  @Get("state/:stateUt/cumulative-preview")
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.NODAL_OFFICER,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER,
    UserRole.ADMIN
  )
  async getCumulativePreviewForState(
    @Param("stateUt") stateUt: string,
    @Request() req,
    @Query("year") year?: string,
    @Query("includeAssignments") includeAssignments?: string
  ) {
    return this.submissionService.buildCumulativePreview({
      stateUt,
      year,
      // includeAssignments: includeAssignments === "true",
      userRole: req.user.role,
      userStateUt: req.user.stateUt,
    });
  }

  @Post("clean-mospi-status/:id")
@UseGuards(RolesGuard)
@Roles(UserRole.STATE_APPROVER)
@HttpCode(HttpStatus.OK)
async cleanMospiStatus(
  @Param("id") id: string,
  @Request() req
): Promise<any> {
  return this.submissionService.cleanMospiStatusFromSubmission(
    id,
    req.user.id,
    req.user.role,
    req.user.stateUt
  );
}
}
