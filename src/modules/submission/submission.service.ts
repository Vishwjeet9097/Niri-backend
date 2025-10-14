import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import {
  Submission,
  SubmissionStatus,
  ReviewComment,
  SubmissionFile,
} from "../../entities/submission.entity";
import { UserRole } from "../../entities/user.entity";
import { FinalScore } from "../../entities/final-score.entity";
import { ScoringService } from "../scoring/scoring.service";
import { StorageService } from "../storage/storage.service";
import {
  CreateSubmissionDto,
  UpdateSubmissionDto,
  AddCommentDto,
  ForwardToMoSPIDto,
  UpdateStatusDto,
  ForwardToMoSPIReviewerDto,
  ForwardToMoSPIApproverDto,
  SendBackToStateDto,
  SubmitWithSectionCommentsDto,
  SectionComment,
  StateRejectDto,
  FinalRejectDto,
  ResubmitDto,
  SubmissionQueryDto,
} from "./dto/submission.dto";

@Injectable()
export class SubmissionService {
  private readonly logger = new Logger(SubmissionService.name);

  constructor(
    @InjectRepository(Submission)
    private submissionRepository: Repository<Submission>,
    @InjectRepository(FinalScore)
    private finalScoreRepository: Repository<FinalScore>,
    private dataSource: DataSource,
    private scoringService: ScoringService,
    private storageService: StorageService
  ) {}

  // Helper function to create comments with appropriate section ID
  private createComment(
    text: string,
    type: "comment" | "rejection" | "approval",
    userRole: UserRole,
    userId: string,
    sectionId?: string
  ): ReviewComment {
    return {
      timestamp: new Date(),
      role: userRole,
      userId,
      text,
      type,
      // If sectionId is provided, use it; otherwise use a default based on comment type
      sectionId:
        sectionId ||
        (type === "comment"
          ? "general"
          : type === "rejection"
            ? "rejection"
            : "approval"),
    };
  }

  async create(
    createSubmissionDto: CreateSubmissionDto,
    userId: string,
    userRole: UserRole,
    stateUt: string
  ): Promise<{
    status: boolean;
    data: Submission;
    message: string;
    timestamp: string;
  }> {
    try {
      this.logger.log(`=== CREATE SUBMISSION START ===`);
      this.logger.log(
        `UserId: ${userId}, UserRole: ${userRole}, StateUt: ${stateUt}`
      );
      this.logger.log(
        `CreateSubmissionDto: ${JSON.stringify(createSubmissionDto)}`
      );

      // Step 1: Validate user role
      if (userRole !== UserRole.NODAL_OFFICER) {
        this.logger.error(
          `Invalid user role: ${userRole}. Expected: NODAL_OFFICER`
        );
        throw new ForbiddenException(
          "Only Nodal Officers can create submissions"
        );
      }

      // Step 2: Check if submission ID already exists
      this.logger.log(
        `Checking for existing submission with ID: ${createSubmissionDto.submissionId}`
      );
      const existingSubmission = await this.submissionRepository.findOne({
        where: { submissionId: createSubmissionDto.submissionId },
      });

      if (existingSubmission) {
        this.logger.error(
          `Submission ID already exists: ${createSubmissionDto.submissionId}`
        );
        throw new BadRequestException("Submission ID already exists");
      }

      // Step 3: Determine status and owner role based on input
      const status = createSubmissionDto.status || SubmissionStatus.DRAFT;
      const currentOwnerRole = this.getOwnerRoleFromStatus(status);

      this.logger.log(
        `Initial Status: ${status}, Owner Role: ${currentOwnerRole}`
      );

      // Step 4: Create submission
      const submission = this.submissionRepository.create({
        submissionId: createSubmissionDto.submissionId,
        formData: createSubmissionDto.formData,
        submittedBy: userId,
        stateUt,
        status: status,
        currentOwnerRole: currentOwnerRole,
      });

      // Step 5: Save submission
      const savedSubmission = await this.submissionRepository.save(submission);

      this.logger.log(`Submission created successfully: ${savedSubmission.id}`);
      this.logger.log(
        `Final Status: ${savedSubmission.status}, Owner: ${savedSubmission.currentOwnerRole}`
      );
      this.logger.log(`=== CREATE SUBMISSION SUCCESS ===`);

      return {
        status: true,
        data: savedSubmission,
        message: "Submission created successfully",
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`=== CREATE SUBMISSION ERROR ===`);
      this.logger.error(`Error creating submission: ${error.message}`);
      this.logger.error(`Stack trace: ${error.stack}`);
      throw error;
    }
  }

  async findAll(
    queryDto: SubmissionQueryDto,
    userRole: UserRole,
    userStateUt: string,
    userId: string
  ): Promise<{ submissions: Submission[]; total: number }> {
    const {
      status,
      stateUt,
      submittedBy,
      currentOwnerRole,
      page = "1",
      limit = "10",
    } = queryDto;

    const query = this.submissionRepository
      .createQueryBuilder("submission")
      .leftJoinAndSelect("submission.user", "user")
      .leftJoinAndSelect("submission.finalScore", "finalScore");

    // Apply role-based filtering
    if (userRole === UserRole.NODAL_OFFICER) {
      query.andWhere("submission.stateUt = :stateUt", { stateUt: userStateUt });
      query.andWhere("submission.submittedBy = :userId", { userId }); // Only own submissions
    } else if (userRole === UserRole.STATE_APPROVER) {
      query.andWhere("submission.stateUt = :stateUt", { stateUt: userStateUt });
    } else if (
      userRole === UserRole.MOSPI_REVIEWER ||
      userRole === UserRole.MOSPI_APPROVER
    ) {
      query.andWhere("submission.stateUt = :stateUt", { stateUt: userStateUt });
    }
    // Only ADMIN can see all submissions

    // Apply filters
    if (status) {
      // Handle comma-separated status values
      const statusArray = status.split(",").map((s) => s.trim());
      if (statusArray.length === 1) {
        query.andWhere("submission.status = :status", {
          status: statusArray[0],
        });
      } else {
        query.andWhere("submission.status IN (:...statuses)", {
          statuses: statusArray,
        });
      }
    }
    if (stateUt) {
      // Only ADMIN can filter by any state
      if (userRole !== UserRole.ADMIN) {
        throw new ForbiddenException(
          "Access denied - can only filter by your own state"
        );
      }
      query.andWhere("submission.stateUt = :stateUt", { stateUt });
    }
    if (currentOwnerRole) {
      query.andWhere("submission.currentOwnerRole = :currentOwnerRole", {
        currentOwnerRole,
      });
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    query.skip(skip).take(parseInt(limit));

    // Order by creation date
    query.orderBy("submission.createdAt", "DESC");

    const [submissions, total] = await query.getManyAndCount();

    return { submissions, total };
  }

  async findOne(
    id: string,
    userRole: UserRole,
    userStateUt: string
  ): Promise<Submission> {
    try {
      this.logger.log(`=== FIND ONE SUBMISSION START ===`);
      this.logger.log(
        `ID: ${id}, UserRole: ${userRole}, StateUt: ${userStateUt}`
      );

      // Step 1: Find submission
      const submission = await this.submissionRepository.findOne({
        where: { id },
        relations: ["user", "finalScore"],
      });

      if (!submission) {
        this.logger.error(`Submission not found with ID: ${id}`);
        throw new NotFoundException("Submission not found");
      }

      this.logger.log(
        `Found submission: ${submission.id}, Status: ${submission.status}, StateUt: ${submission.stateUt}`
      );

      // Step 2: Check access permissions
      if (
        userRole === UserRole.NODAL_OFFICER &&
        submission.stateUt !== userStateUt
      ) {
        this.logger.error(
          `Access denied for NODAL_OFFICER. Submission StateUt: ${submission.stateUt}, User StateUt: ${userStateUt}`
        );
        throw new ForbiddenException("Access denied");
      }
      if (
        userRole === UserRole.STATE_APPROVER &&
        submission.stateUt !== userStateUt
      ) {
        this.logger.error(
          `Access denied for STATE_APPROVER. Submission StateUt: ${submission.stateUt}, User StateUt: ${userStateUt}`
        );
        throw new ForbiddenException("Access denied");
      }

      this.logger.log(`Access granted for user role: ${userRole}`);
      this.logger.log(`=== FIND ONE SUBMISSION SUCCESS ===`);

      return submission;
    } catch (error) {
      this.logger.error(`=== FIND ONE SUBMISSION ERROR ===`);
      this.logger.error(`Error finding submission ${id}: ${error.message}`);
      this.logger.error(`Stack trace: ${error.stack}`);
      throw error;
    }
  }

  async update(
    id: string,
    updateSubmissionDto: UpdateSubmissionDto,
    userId: string,
    userRole: UserRole,
    userStateUt: string
  ): Promise<Submission> {
    try {
      this.logger.log(`=== UPDATE SUBMISSION START ===`);
      this.logger.log(
        `ID: ${id}, UserId: ${userId}, UserRole: ${userRole}, StateUt: ${userStateUt}`
      );
      this.logger.log(
        `UpdateSubmissionDto: ${JSON.stringify(updateSubmissionDto)}`
      );

      // Step 1: Find submission
      const submission = await this.findOne(id, userRole, userStateUt);
      this.logger.log(`Found submission with status: ${submission.status}`);

      // Step 2: Validate user role and ownership
      if (
        userRole !== UserRole.NODAL_OFFICER ||
        submission.submittedBy !== userId
      ) {
        this.logger.error(
          `Invalid user role or ownership. UserRole: ${userRole}, Owner: ${submission.submittedBy}`
        );
        throw new ForbiddenException(
          "Only Nodal Officers can update their own submissions"
        );
      }

      // Step 3: Validate submission status
      if (submission.status !== SubmissionStatus.DRAFT) {
        this.logger.error(
          `Invalid status for update: ${submission.status}. Expected: DRAFT`
        );
        throw new BadRequestException(
          "Cannot update submission that has been submitted"
        );
      }

      // Step 4: Update submission
      this.logger.log(
        `Updating submission with data: ${JSON.stringify(updateSubmissionDto)}`
      );
      await this.submissionRepository.update(id, updateSubmissionDto);

      // Step 5: Return updated submission
      const updatedSubmission = await this.findOne(id, userRole, userStateUt);
      this.logger.log(
        `Submission updated successfully: ${updatedSubmission.id}`
      );
      this.logger.log(`=== UPDATE SUBMISSION SUCCESS ===`);

      return updatedSubmission;
    } catch (error) {
      this.logger.error(`=== UPDATE SUBMISSION ERROR ===`);
      this.logger.error(`Error updating submission ${id}: ${error.message}`);
      this.logger.error(`Stack trace: ${error.stack}`);
      throw error;
    }
  }

  async addComment(
    id: string,
    addCommentDto: AddCommentDto,
    userId: string,
    userRole: UserRole,
    userStateUt: string
  ): Promise<Submission> {
    try {
      this.logger.log(`=== ADD COMMENT START ===`);
      this.logger.log(
        `ID: ${id}, UserId: ${userId}, UserRole: ${userRole}, StateUt: ${userStateUt}`
      );
      this.logger.log(`AddCommentDto: ${JSON.stringify(addCommentDto)}`);

      // Step 1: Find submission
      const submission = await this.findOne(id, userRole, userStateUt);
      this.logger.log(`Found submission with status: ${submission.status}`);

      // Step 2: Create comment using helper function
      const comment = this.createComment(
        addCommentDto.text,
        addCommentDto.type,
        userRole,
        userId,
        addCommentDto.sectionId
      );

      this.logger.log(
        `Adding comment: ${addCommentDto.text} (Type: ${addCommentDto.type}) for section: ${addCommentDto.sectionId}`
      );

      // Step 3: Update comments
      const updatedComments = [...submission.reviewComments, comment];
      this.logger.log(`Total comments after update: ${updatedComments.length}`);

      // Step 4: Save updated submission
      await this.submissionRepository.update(id, {
        reviewComments: updatedComments,
      });

      // Step 5: Return updated submission
      const updatedSubmission = await this.findOne(id, userRole, userStateUt);
      this.logger.log(
        `Comment added successfully to submission: ${updatedSubmission.id}`
      );
      this.logger.log(`=== ADD COMMENT SUCCESS ===`);

      return updatedSubmission;
    } catch (error) {
      this.logger.error(`=== ADD COMMENT ERROR ===`);
      this.logger.error(
        `Error adding comment to submission ${id}: ${error.message}`
      );
      this.logger.error(`Stack trace: ${error.stack}`);
      throw error;
    }
  }

  async submitToState(
    id: string,
    userId: string,
    userRole: UserRole,
    userStateUt: string
  ): Promise<Submission> {
    try {
      this.logger.log(`=== SUBMIT TO STATE START ===`);
      this.logger.log(
        `ID: ${id}, UserId: ${userId}, UserRole: ${userRole}, StateUt: ${userStateUt}`
      );

      // Step 1: Validate user role
      if (userRole !== UserRole.NODAL_OFFICER) {
        this.logger.error(
          `Invalid user role: ${userRole}. Expected: NODAL_OFFICER`
        );
        throw new ForbiddenException("Only Nodal Officers can submit to state");
      }

      // Step 2: Find submission
      const submission = await this.findOne(id, userRole, userStateUt);
      this.logger.log(`Found submission with status: ${submission.status}`);

      // Step 3: Validate submission status
      if (submission.status !== SubmissionStatus.DRAFT) {
        this.logger.error(
          `Invalid status for submit to state: ${submission.status}. Expected: DRAFT`
        );
        throw new BadRequestException(
          "Submission must be in draft status to submit to state"
        );
      }

      // Step 4: Update submission status
      this.logger.log(`Updating submission status to: SUBMITTED_TO_STATE`);
      this.logger.log(`Updating owner role to: STATE_APPROVER`);
      await this.submissionRepository.update(id, {
        status: SubmissionStatus.SUBMITTED_TO_STATE,
        currentOwnerRole: UserRole.STATE_APPROVER,
      });

      // Step 5: Return updated submission
      const updatedSubmission = await this.findOne(id, userRole, userStateUt);
      this.logger.log(
        `Submission submitted to state successfully: ${updatedSubmission.id}`
      );
      this.logger.log(
        `Final Status: ${updatedSubmission.status}, Owner: ${updatedSubmission.currentOwnerRole}`
      );
      this.logger.log(`=== SUBMIT TO STATE SUCCESS ===`);

      return updatedSubmission;
    } catch (error) {
      this.logger.error(`=== SUBMIT TO STATE ERROR ===`);
      this.logger.error(`Error submitting to state ${id}: ${error.message}`);
      this.logger.error(`Stack trace: ${error.stack}`);
      throw error;
    }
  }

  async submitWithSectionComments(
    id: string,
    submitDto: SubmitWithSectionCommentsDto,
    userId: string,
    userRole: UserRole,
    userStateUt: string
  ): Promise<Submission> {
    try {
      this.logger.log(`=== SUBMIT WITH SECTION COMMENTS START ===`);
      this.logger.log(
        `ID: ${id}, UserId: ${userId}, UserRole: ${userRole}, StateUt: ${userStateUt}`
      );
      this.logger.log(
        `SubmitDto formData keys: ${Object.keys(submitDto.formData)}`
      );
      this.logger.log(
        `Section comments count: ${submitDto.sectionComments?.length || 0}`
      );

      // Step 1: Validate user role
      if (userRole !== UserRole.NODAL_OFFICER) {
        this.logger.error(
          `Invalid user role: ${userRole}. Expected: NODAL_OFFICER`
        );
        throw new ForbiddenException(
          "Only Nodal Officers can submit with section comments"
        );
      }

      // Step 2: Find submission
      const submission = await this.findOne(id, userRole, userStateUt);
      this.logger.log(`Found submission with status: ${submission.status}`);

      // Step 3: Validate submission status
      if (submission.status !== SubmissionStatus.DRAFT) {
        this.logger.error(
          `Invalid status for submit with comments: ${submission.status}. Expected: DRAFT`
        );
        throw new BadRequestException(
          "Submission must be in draft status to submit with comments"
        );
      }

      // Use transaction to ensure all updates are atomic
      return this.dataSource.transaction(async (manager) => {
        // Step 4: Update form data
        await manager.update(Submission, id, {
          formData: submitDto.formData,
          updatedAt: new Date(),
        });

        // Step 5: Add section comments if provided
        let updatedComments = [...submission.reviewComments];

        if (submitDto.sectionComments && submitDto.sectionComments.length > 0) {
          for (const sectionComment of submitDto.sectionComments) {
            const comment: ReviewComment = {
              timestamp: new Date(),
              role: userRole,
              userId,
              text: sectionComment.text,
              type: sectionComment.type,
              sectionId: sectionComment.sectionId,
            };

            updatedComments.push(comment);
            this.logger.log(
              `Added comment for section ${sectionComment.sectionId}: ${sectionComment.text}`
            );
          }
        }

        // Step 6: Add overall comment if provided
        if (submitDto.overallComment) {
          const overallComment: ReviewComment = {
            timestamp: new Date(),
            role: userRole,
            userId,
            text: submitDto.overallComment,
            type: "comment",
            sectionId: "overall", // Using "overall" as the section ID for overall comments
          };

          updatedComments.push(overallComment);
          this.logger.log(`Added overall comment: ${submitDto.overallComment}`);
        }

        // Step 7: Update status and comments
        this.logger.log(`Updating submission status to: SUBMITTED_TO_STATE`);
        this.logger.log(`Updating owner role to: STATE_APPROVER`);
        await manager.update(Submission, id, {
          status: SubmissionStatus.SUBMITTED_TO_STATE,
          currentOwnerRole: UserRole.STATE_APPROVER,
          reviewComments: updatedComments,
        });

        // Step 8: Return updated submission
        const updatedSubmission = await this.findOne(id, userRole, userStateUt);
        this.logger.log(
          `Submission with section comments submitted successfully: ${updatedSubmission.id}`
        );
        this.logger.log(
          `Final Status: ${updatedSubmission.status}, Owner: ${updatedSubmission.currentOwnerRole}`
        );
        this.logger.log(
          `Total comments: ${updatedSubmission.reviewComments.length}`
        );
        this.logger.log(`=== SUBMIT WITH SECTION COMMENTS SUCCESS ===`);

        return updatedSubmission;
      });
    } catch (error) {
      this.logger.error(`=== SUBMIT WITH SECTION COMMENTS ERROR ===`);
      this.logger.error(
        `Error submitting with section comments ${id}: ${error.message}`
      );
      this.logger.error(`Stack trace: ${error.stack}`);
      throw error;
    }
  }

  async forwardToMoSPI(
    id: string,
    forwardDto: ForwardToMoSPIDto,
    userId: string,
    userRole: UserRole,
    userStateUt: string
  ): Promise<Submission> {
    try {
      console.log("=== FORWARD TO MOSPI DEBUG START ===");
      console.log("ID:", id);
      console.log("ForwardDto:", forwardDto);
      console.log("UserId:", userId);
      console.log("UserRole:", userRole);
      console.log("UserStateUt:", userStateUt);
      console.log("UserRole.STATE_APPROVER:", UserRole.STATE_APPROVER);
      console.log("Role comparison:", userRole === UserRole.STATE_APPROVER);

      this.logger.log(
        `Forwarding submission ${id} to MoSPI by user ${userId} with role ${userRole}`
      );

      if (userRole !== UserRole.STATE_APPROVER) {
        console.log("Role check failed - throwing ForbiddenException");
        throw new ForbiddenException(
          "Only State Approvers can forward submissions to MoSPI"
        );
      }

      console.log("Role check passed, finding submission...");
      const submission = await this.findOne(id, userRole, userStateUt);
      console.log("Submission found:", {
        id: submission.id,
        status: submission.status,
        currentOwnerRole: submission.currentOwnerRole,
        stateUt: submission.stateUt,
      });

      this.logger.log(
        `Found submission: ${JSON.stringify({
          id: submission.id,
          status: submission.status,
          currentOwnerRole: submission.currentOwnerRole,
          stateUt: submission.stateUt,
        })}`
      );

      console.log("Checking status...");
      console.log("Current status:", submission.status);
      console.log("Expected status:", SubmissionStatus.SUBMITTED_TO_STATE);
      console.log(
        "Status comparison:",
        submission.status === SubmissionStatus.SUBMITTED_TO_STATE
      );

      if (submission.status !== SubmissionStatus.SUBMITTED_TO_STATE) {
        console.log("Status check failed - throwing BadRequestException");
        throw new BadRequestException(
          `Submission must be in SUBMITTED_TO_STATE status, but current status is ${submission.status}`
        );
      }

      console.log("Status check passed, processing comments...");
      // Add comment if provided using helper function
      let updatedComments = [...submission.reviewComments];
      if (forwardDto.comment) {
        const comment = this.createComment(
          forwardDto.comment,
          "comment",
          userRole,
          userId,
          "status-change" // Using status-change as the section ID for status change comments
        );
        updatedComments.push(comment);
        console.log("Comment added:", comment);
      }

      console.log("Updating submission...");
      console.log("New status:", SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER);
      console.log("New currentOwnerRole:", UserRole.MOSPI_REVIEWER);
      console.log("Updated comments count:", updatedComments.length);

      this.logger.log(
        `Updating submission with status: ${SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER}, currentOwnerRole: ${UserRole.MOSPI_REVIEWER}`
      );

      // Update submission
      const updateResult = await this.submissionRepository.update(id, {
        status: SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
        currentOwnerRole: UserRole.MOSPI_REVIEWER,
        reviewComments: updatedComments,
      });

      console.log("Update result:", updateResult);

      console.log("Fetching updated submission...");
      const updatedSubmission = await this.findOne(id, userRole, userStateUt);
      console.log("Updated submission:", {
        id: updatedSubmission.id,
        status: updatedSubmission.status,
        currentOwnerRole: updatedSubmission.currentOwnerRole,
      });

      console.log("=== FORWARD TO MOSPI DEBUG END ===");
      return updatedSubmission;
    } catch (error) {
      console.log("=== ERROR IN FORWARD TO MOSPI ===");
      console.log("Error message:", error.message);
      console.log("Error stack:", error.stack);
      console.log("=== ERROR END ===");
      this.logger.error(
        `Error in forwardToMoSPI: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  async stateReject(
    id: string,
    rejectDto: StateRejectDto,
    userId: string,
    userRole: UserRole,
    userStateUt: string
  ): Promise<Submission> {
    try {
      this.logger.log(`=== STATE REJECT START ===`);
      this.logger.log(
        `ID: ${id}, UserId: ${userId}, UserRole: ${userRole}, StateUt: ${userStateUt}`
      );
      this.logger.log(`RejectDto: ${JSON.stringify(rejectDto)}`);

      // Step 1: Validate user role
      if (
        userRole !== UserRole.STATE_APPROVER &&
        userRole !== UserRole.MOSPI_APPROVER
      ) {
        this.logger.error(
          `Invalid user role: ${userRole}. Expected: STATE_APPROVER or MOSPI_APPROVER`
        );
        throw new ForbiddenException(
          "Only State Approvers or MoSPI Approvers can reject submissions"
        );
      }

      // Step 2: Find submission
      const submission = await this.findOne(id, userRole, userStateUt);
      this.logger.log(`Found submission with status: ${submission.status}`);

      // Step 3: Validate submission status based on user role
      if (userRole === UserRole.STATE_APPROVER) {
        if (
          submission.status !== SubmissionStatus.SUBMITTED_TO_STATE &&
          submission.status !== SubmissionStatus.RETURNED_FROM_MOSPI &&
          submission.status !== SubmissionStatus.RETURNED_FROM_STATE
        ) {
          this.logger.error(
            `Invalid status for State reject: ${submission.status}. Expected: SUBMITTED_TO_STATE, RETURNED_FROM_MOSPI, or RETURNED_FROM_STATE`
          );
          throw new BadRequestException(
            "Submission must be in SUBMITTED_TO_STATE, RETURNED_FROM_MOSPI, or RETURNED_FROM_STATE status"
          );
        }
      } else if (userRole === UserRole.MOSPI_APPROVER) {
        if (
          submission.status !== SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER
        ) {
          this.logger.error(
            `Invalid status for MoSPI return: ${submission.status}. Expected: SUBMITTED_TO_MOSPI_APPROVER`
          );
          throw new BadRequestException(
            "Submission must be in SUBMITTED_TO_MOSPI_APPROVER status"
          );
        }
      }

      // Step 4: Validate target status based on user role
      if (userRole === UserRole.STATE_APPROVER) {
        if (
          rejectDto.status !== SubmissionStatus.REJECTED &&
          rejectDto.status !== SubmissionStatus.RETURNED_FROM_STATE
        ) {
          this.logger.error(
            `Invalid target status: ${rejectDto.status}. Expected: REJECTED or RETURNED_FROM_STATE`
          );
          throw new BadRequestException(
            "State rejection must set status to REJECTED or RETURNED_FROM_STATE"
          );
        }
      } else if (userRole === UserRole.MOSPI_APPROVER) {
        if (rejectDto.status !== SubmissionStatus.RETURNED_FROM_MOSPI) {
          this.logger.error(
            `Invalid target status: ${rejectDto.status}. Expected: RETURNED_FROM_MOSPI`
          );
          throw new BadRequestException(
            "MoSPI return must set status to RETURNED_FROM_MOSPI"
          );
        }
      }

      // Step 5: Process rejection in transaction
      this.logger.log(
        `Processing state rejection with comment: ${rejectDto.comment}`
      );
      return this.dataSource.transaction(async (manager) => {
        // Add rejection comment using helper function
        const comment = this.createComment(
          rejectDto.comment,
          "rejection",
          userRole,
          userId
        );

        this.logger.log(`Adding rejection comment: ${rejectDto.comment}`);

        await manager.update(Submission, id, {
          status: rejectDto.status,
          currentOwnerRole: UserRole.NODAL_OFFICER,
          reviewComments: [...submission.reviewComments, comment],
        });

        this.logger.log(`State rejection completed successfully`);
        this.logger.log(
          `Final Status: ${rejectDto.status}, Owner: NODAL_OFFICER`
        );
        this.logger.log(`=== STATE REJECT SUCCESS ===`);

        return this.findOne(id, userRole, userStateUt);
      });
    } catch (error) {
      this.logger.error(`=== STATE REJECT ERROR ===`);
      this.logger.error(`Error rejecting submission ${id}: ${error.message}`);
      this.logger.error(`Stack trace: ${error.stack}`);
      throw error;
    }
  }

  async finalReject(
    id: string,
    rejectDto: FinalRejectDto,
    userId: string,
    userRole: UserRole,
    userStateUt: string
  ): Promise<Submission> {
    try {
      this.logger.log(`=== FINAL REJECT START ===`);
      this.logger.log(
        `ID: ${id}, UserId: ${userId}, UserRole: ${userRole}, StateUt: ${userStateUt}`
      );
      this.logger.log(`RejectDto: ${JSON.stringify(rejectDto)}`);

      // Step 1: Validate user role
      if (
        userRole !== UserRole.MOSPI_APPROVER &&
        userRole !== UserRole.STATE_APPROVER
      ) {
        this.logger.error(
          `Invalid user role: ${userRole}. Expected: MOSPI_APPROVER or STATE_APPROVER`
        );
        throw new ForbiddenException(
          "Only MoSPI Approvers or State Approvers can perform final rejection"
        );
      }

      // Step 2: Find submission
      const submission = await this.findOne(id, userRole, userStateUt);
      this.logger.log(`Found submission with status: ${submission.status}`);

      // Step 3: Validate submission status based on user role
      if (userRole === UserRole.MOSPI_APPROVER) {
        if (
          submission.status !== SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER
        ) {
          this.logger.error(
            `Invalid status for MoSPI final reject: ${submission.status}. Expected: SUBMITTED_TO_MOSPI_APPROVER`
          );
          throw new BadRequestException(
            "Submission must be in SUBMITTED_TO_MOSPI_APPROVER status"
          );
        }
      } else if (userRole === UserRole.STATE_APPROVER) {
        if (
          submission.status !== SubmissionStatus.SUBMITTED_TO_STATE &&
          submission.status !== SubmissionStatus.REJECTED
        ) {
          this.logger.error(
            `Invalid status for State final reject: ${submission.status}. Expected: SUBMITTED_TO_STATE or REJECTED`
          );
          throw new BadRequestException(
            "Submission must be in SUBMITTED_TO_STATE or REJECTED status"
          );
        }
      }

      // Step 4: Validate target status based on user role
      if (userRole === UserRole.MOSPI_APPROVER) {
        if (rejectDto.status !== SubmissionStatus.REJECTED_FINAL) {
          this.logger.error(
            `Invalid target status for MoSPI: ${rejectDto.status}. Expected: REJECTED_FINAL`
          );
          throw new BadRequestException(
            "MoSPI final rejection must set status to REJECTED_FINAL"
          );
        }
      } else if (userRole === UserRole.STATE_APPROVER) {
        if (rejectDto.status !== SubmissionStatus.REJECTED) {
          this.logger.error(
            `Invalid target status for State: ${rejectDto.status}. Expected: REJECTED`
          );
          throw new BadRequestException(
            "State final rejection must set status to REJECTED"
          );
        }
      }

      // Step 5: Process final rejection in transaction
      this.logger.log(
        `Processing final rejection with comment: ${rejectDto.comment}`
      );
      return this.dataSource.transaction(async (manager) => {
        // Add rejection comment using helper function
        const comment = this.createComment(
          rejectDto.comment,
          "rejection",
          userRole,
          userId
        );

        this.logger.log(`Adding final rejection comment: ${rejectDto.comment}`);

        const updatedSubmission = await manager.save(Submission, {
          ...submission,
          status: rejectDto.status,
          currentOwnerRole: this.getOwnerRoleFromStatus(rejectDto.status),
          reviewComments: [...submission.reviewComments, comment],
        });

        this.logger.log(`Final rejection completed successfully`);
        this.logger.log(
          `Final Status: ${updatedSubmission.status}, Owner: ${updatedSubmission.currentOwnerRole}`
        );
        this.logger.log(`=== FINAL REJECT SUCCESS ===`);

        return updatedSubmission;
      });
    } catch (error) {
      this.logger.error(`=== FINAL REJECT ERROR ===`);
      this.logger.error(
        `Error performing final rejection on submission ${id}: ${error.message}`
      );
      this.logger.error(`Stack trace: ${error.stack}`);
      throw error;
    }
  }

  async resubmit(
    id: string,
    resubmitDto: ResubmitDto,
    userId: string,
    userRole: UserRole,
    userStateUt: string
  ): Promise<Submission> {
    try {
      this.logger.log(`=== RESUBMIT START ===`);
      this.logger.log(
        `ID: ${id}, UserId: ${userId}, UserRole: ${userRole}, StateUt: ${userStateUt}`
      );
      this.logger.log(`ResubmitDto: ${JSON.stringify(resubmitDto)}`);

      // Step 1: Validate user role
      if (userRole !== UserRole.NODAL_OFFICER) {
        this.logger.error(
          `Invalid user role: ${userRole}. Expected: NODAL_OFFICER`
        );
        throw new ForbiddenException("Only Nodal Officers can resubmit");
      }

      // Step 2: Find submission
      const submission = await this.findOne(id, userRole, userStateUt);
      this.logger.log(`Found submission with status: ${submission.status}`);

      // Step 3: Validate ownership
      if (submission.submittedBy !== userId) {
        this.logger.error(
          `Invalid ownership. SubmittedBy: ${submission.submittedBy}, CurrentUser: ${userId}`
        );
        throw new ForbiddenException("Can only resubmit your own submissions");
      }

      // Step 4: Validate submission status
      if (submission.status !== SubmissionStatus.REJECTED) {
        this.logger.error(
          `Invalid status for resubmit: ${submission.status}. Expected: REJECTED`
        );
        throw new BadRequestException("Can only resubmit rejected submissions");
      }

      // Step 5: Process resubmission in transaction
      this.logger.log(
        `Processing resubmission with rejection count: ${submission.rejectionCount}`
      );
      return this.dataSource.transaction(async (manager) => {
        // Add resubmission comment if provided
        let updatedComments = submission.reviewComments;
        if (resubmitDto.comment) {
          const comment = this.createComment(
            resubmitDto.comment,
            "comment",
            userRole,
            userId,
            "resubmission"
          );
          updatedComments = [...updatedComments, comment];
          this.logger.log(
            `Adding resubmission comment: ${resubmitDto.comment}`
          );
        }

        this.logger.log(`Updating submission status to: SUBMITTED_TO_STATE`);
        this.logger.log(`Updating owner role to: STATE_APPROVER`);
        this.logger.log(
          `Incrementing rejection count to: ${submission.rejectionCount + 1}`
        );

        await manager.update(Submission, id, {
          status: SubmissionStatus.SUBMITTED_TO_STATE,
          currentOwnerRole: UserRole.STATE_APPROVER,
          rejectionCount: submission.rejectionCount + 1,
          formData: resubmitDto.formData || submission.formData,
          reviewComments: updatedComments,
        });

        this.logger.log(`Resubmission completed successfully`);
        this.logger.log(
          `Final Status: SUBMITTED_TO_STATE, Owner: STATE_APPROVER`
        );
        this.logger.log(`=== RESUBMIT SUCCESS ===`);

        return this.findOne(id, userRole, userStateUt);
      });
    } catch (error) {
      this.logger.error(`=== RESUBMIT ERROR ===`);
      this.logger.error(
        `Error resubmitting submission ${id}: ${error.message}`
      );
      this.logger.error(`Stack trace: ${error.stack}`);
      throw error;
    }
  }

  async approve(
    id: string,
    approveDto: { status: SubmissionStatus; comment?: string },
    userId: string,
    userRole: UserRole,
    userStateUt: string
  ): Promise<Submission> {
    try {
      this.logger.log(`=== APPROVE SUBMISSION START ===`);
      this.logger.log(
        `ID: ${id}, UserId: ${userId}, UserRole: ${userRole}, StateUt: ${userStateUt}`
      );
      this.logger.log(`ApproveDto: ${JSON.stringify(approveDto)}`);

      // Step 1: Verify user role
      if (userRole !== UserRole.MOSPI_APPROVER) {
        this.logger.error(
          `Invalid user role: ${userRole}. Expected: MOSPI_APPROVER`
        );
        throw new ForbiddenException(
          `Only MoSPI Approvers can approve submissions. Current role: ${userRole}`
        );
      }

      // Step 2: Check if status is provided in payload
      if (!approveDto.status) {
        this.logger.error(`Missing status in payload`);
        throw new BadRequestException("Status is required in payload");
      }

      // Step 3: Find submission
      const submission = await this.findOne(id, userRole, userStateUt);
      this.logger.log(`Found submission with status: ${submission.status}`);

      // Step 4: Validate current status
      if (submission.status !== SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER) {
        this.logger.error(
          `Invalid current status: ${submission.status}. Expected: SUBMITTED_TO_MOSPI_APPROVER`
        );
        throw new BadRequestException(
          `Submission must be in SUBMITTED_TO_MOSPI_APPROVER status. Current status: ${submission.status}`
        );
      }

      // Step 5: Validate target status
      if (approveDto.status !== SubmissionStatus.APPROVED) {
        this.logger.error(
          `Invalid target status: ${approveDto.status}. Expected: APPROVED`
        );
        throw new BadRequestException(
          `Approval must set status to APPROVED. Provided status: ${approveDto.status}`
        );
      }

      // Step 6: Add approval comment using helper function
      const comment = this.createComment(
        approveDto.comment || "Submission approved",
        "approval",
        userRole,
        userId
      );

      // Step 7: Prepare updated comments
      const updatedComments = [...submission.reviewComments, comment];
      this.logger.log(
        `Adding comment: ${approveDto.comment || "Submission approved"}`
      );

      // Step 8: Update submission using raw SQL (same as working endpoints)
      this.logger.log(`Updating submission with status: ${approveDto.status}`);
      const result = await this.dataSource.query(
        `UPDATE submissions 
         SET status = $1, 
             current_owner_role = $2, 
             review_comments = $3::jsonb,
             "updatedAt" = CURRENT_TIMESTAMP 
         WHERE id = $4
         RETURNING id, status, current_owner_role, review_comments`,
        [
          approveDto.status,
          this.getOwnerRoleFromStatus(approveDto.status),
          JSON.stringify(updatedComments), // Pass as JSON string
          id,
        ]
      );

      this.logger.log(`Update result: ${JSON.stringify(result)}`);

      // Step 9: Calculate and store final score (after status is updated)
      try {
        const finalScore = await this.scoringService.calculateScore(id, userId);
        this.logger.log(
          `Final score calculated successfully for submission: ${id}, Score: ${finalScore.totalScore}`
        );
      } catch (scoringError) {
        this.logger.error(
          `Scoring failed for submission ${id}: ${scoringError.message}`
        );
        // Note: We don't rollback here as the main approval is already done
      }

      // Step 10: Return updated submission
      const updatedSubmission = await this.findOne(id, userRole, userStateUt);
      this.logger.log(`=== APPROVE SUBMISSION SUCCESS ===`);
      return updatedSubmission;
    } catch (error) {
      this.logger.error(`=== APPROVE SUBMISSION ERROR ===`);
      this.logger.error(`Error approving submission ${id}: ${error.message}`);
      this.logger.error(`Stack trace: ${error.stack}`);
      throw error;
    }
  }

  async addFileToSubmission(
    submissionId: string,
    file: SubmissionFile,
    userId: string,
    userRole: UserRole,
    userStateUt: string
  ): Promise<Submission> {
    const submission = await this.findOne(submissionId, userRole, userStateUt);

    // Only Nodal Officers can add files to their own submissions
    if (
      userRole !== UserRole.NODAL_OFFICER ||
      submission.submittedBy !== userId
    ) {
      throw new ForbiddenException(
        "Only Nodal Officers can add files to their own submissions"
      );
    }

    // Can only add files if not yet submitted to MoSPI
    if (submission.status !== SubmissionStatus.SUBMITTED_TO_STATE) {
      throw new BadRequestException(
        "Cannot add files to submission that has been forwarded to MoSPI"
      );
    }

    const updatedFiles = [...submission.attachedFiles, file];

    await this.submissionRepository.update(submissionId, {
      attachedFiles: updatedFiles,
    });

    return this.findOne(submissionId, userRole, userStateUt);
  }

  async removeFileFromSubmission(
    submissionId: string,
    filePath: string,
    userId: string,
    userRole: UserRole,
    userStateUt: string
  ): Promise<Submission> {
    const submission = await this.findOne(submissionId, userRole, userStateUt);

    // Only Nodal Officers can remove files from their own submissions
    if (
      userRole !== UserRole.NODAL_OFFICER ||
      submission.submittedBy !== userId
    ) {
      throw new ForbiddenException(
        "Only Nodal Officers can remove files from their own submissions"
      );
    }

    // Can only remove files if not yet submitted to MoSPI
    if (submission.status !== SubmissionStatus.SUBMITTED_TO_STATE) {
      throw new BadRequestException(
        "Cannot remove files from submission that has been forwarded to MoSPI"
      );
    }

    const updatedFiles = submission.attachedFiles.filter(
      (file) => file.filePath !== filePath
    );

    // Delete file from storage
    await this.storageService.deleteFile(filePath);

    await this.submissionRepository.update(submissionId, {
      attachedFiles: updatedFiles,
    });

    return this.findOne(submissionId, userRole, userStateUt);
  }

  async getSubmissionFiles(
    submissionId: string,
    userRole: UserRole,
    userStateUt: string
  ): Promise<SubmissionFile[]> {
    const submission = await this.findOne(submissionId, userRole, userStateUt);
    return submission.attachedFiles;
  }

  async cleanupSubmissionFiles(submissionId: string): Promise<void> {
    try {
      const submission = await this.submissionRepository.findOne({
        where: { id: submissionId },
        select: ["attachedFiles"],
      });

      if (submission && submission.attachedFiles.length > 0) {
        const filePaths = submission.attachedFiles.map((file) => file.filePath);
        await this.storageService.deleteSubmissionFiles(
          submissionId,
          filePaths
        );
        this.logger.log(
          `Cleaned up ${filePaths.length} files for submission: ${submissionId}`
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to cleanup files for submission ${submissionId}: ${error.message}`
      );
    }
  }

  // Helper method to get owner role from status
  private getOwnerRoleFromStatus(status: SubmissionStatus): UserRole {
    switch (status) {
      case SubmissionStatus.DRAFT:
        return UserRole.NODAL_OFFICER;
      case SubmissionStatus.SUBMITTED_TO_STATE:
        return UserRole.STATE_APPROVER;
      case SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER:
        return UserRole.MOSPI_REVIEWER;
      case SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER:
        return UserRole.MOSPI_APPROVER;
      case SubmissionStatus.REJECTED:
        return UserRole.NODAL_OFFICER;
      case SubmissionStatus.REJECTED_FINAL:
        return UserRole.MOSPI_APPROVER;
      case SubmissionStatus.RETURNED_FROM_STATE:
        return UserRole.NODAL_OFFICER;
      case SubmissionStatus.RETURNED_FROM_MOSPI:
        return UserRole.NODAL_OFFICER;
      case SubmissionStatus.APPROVED:
        return UserRole.MOSPI_APPROVER; // Keep as MOSPI_APPROVER for final approval
      default:
        return UserRole.NODAL_OFFICER;
    }
  }

  // Update submission status
  async updateStatus(
    id: string,
    updateStatusDto: UpdateStatusDto,
    userId: string,
    userRole: UserRole,
    userStateUt: string
  ): Promise<Submission> {
    try {
      this.logger.log(
        `Updating status for submission ${id} to ${updateStatusDto.status} by user ${userId}`
      );

      const submission = await this.findOne(id, userRole, userStateUt);

      // Validate status transition
      this.validateStatusTransition(
        submission.status,
        updateStatusDto.status,
        userRole
      );

      const newOwnerRole = this.getOwnerRoleFromStatus(updateStatusDto.status);

      // Add comment if provided using helper function
      let updatedComments = [...submission.reviewComments];
      if (updateStatusDto.comment) {
        const comment = this.createComment(
          updateStatusDto.comment,
          "comment",
          userRole,
          userId,
          "status-change"
        );
        updatedComments.push(comment);
      }

      await this.submissionRepository.update(id, {
        status: updateStatusDto.status,
        currentOwnerRole: newOwnerRole,
        reviewComments: updatedComments,
      });

      const updatedSubmission = await this.findOne(id, userRole, userStateUt);
      this.logger.log(`Status updated successfully for submission ${id}`);

      return updatedSubmission;
    } catch (error) {
      this.logger.error(
        `Error updating status for submission ${id}: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  // Forward to MoSPI Reviewer
  async forwardToMoSPIReviewer(
    id: string,
    forwardDto: ForwardToMoSPIReviewerDto,
    userId: string,
    userRole: UserRole,
    userStateUt: string
  ): Promise<Submission> {
    try {
      this.logger.log(`=== FORWARD TO MOSPI REVIEWER START ===`);
      this.logger.log(
        `ID: ${id}, UserId: ${userId}, UserRole: ${userRole}, StateUt: ${userStateUt}`
      );
      this.logger.log(`ForwardDto: ${JSON.stringify(forwardDto)}`);

      // Step 1: Verify user role
      if (userRole !== UserRole.STATE_APPROVER) {
        this.logger.error(
          `Invalid user role: ${userRole}. Expected: STATE_APPROVER`
        );
        throw new ForbiddenException(
          `Only State Approvers can forward to MoSPI Reviewer. Current role: ${userRole}`
        );
      }

      // Step 2: Check if status is provided in payload
      if (!forwardDto.status) {
        this.logger.error(`Missing status in payload`);
        throw new BadRequestException("Status is required in payload");
      }

      // Step 3: Find submission
      this.logger.log(`Finding submission with ID: ${id}`);
      const submission = await this.findOne(id, userRole, userStateUt);
      this.logger.log(`Found submission with status: ${submission.status}`);

      // Step 4: Validate current status
      if (submission.status !== SubmissionStatus.SUBMITTED_TO_STATE) {
        this.logger.error(
          `Invalid status transition from ${submission.status} to ${forwardDto.status}`
        );
        throw new BadRequestException(
          `Submission must be in SUBMITTED_TO_STATE status to forward to MoSPI Reviewer. Current status: ${submission.status}`
        );
      }

      // Step 5: Validate target status
      if (forwardDto.status !== SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER) {
        this.logger.error(`Invalid target status: ${forwardDto.status}`);
        throw new BadRequestException(
          `Invalid status for forwarding to MoSPI Reviewer. Expected: SUBMITTED_TO_MOSPI_REVIEWER, Got: ${forwardDto.status}`
        );
      }

      // Step 6: Prepare comment if provided
      let updatedComments = [...submission.reviewComments];
      if (forwardDto.comment) {
        this.logger.log(`Adding comment: ${forwardDto.comment}`);
        const comment = this.createComment(
          forwardDto.comment,
          "comment",
          userRole,
          userId,
          forwardDto.sectionId
        );
        updatedComments.push(comment);
      }

      // Step 7: Update using Raw SQL with proper PostgreSQL JSONB array handling
      this.logger.log(`Updating submission with status: ${forwardDto.status}`);
      this.logger.log(
        `Review comments to update: ${JSON.stringify(updatedComments)}`
      );

      // Log the exact data being saved
      this.logger.log(`=== DATABASE UPDATE DATA ===`);
      this.logger.log(`Submission ID: ${id}`);
      this.logger.log(`Status: ${forwardDto.status}`);
      this.logger.log(`Current Owner Role: ${UserRole.MOSPI_REVIEWER}`);
      this.logger.log(`Review Comments Count: ${updatedComments.length}`);
      this.logger.log(
        `Review Comments JSON: ${JSON.stringify(updatedComments)}`
      );

      // Use raw SQL with proper PostgreSQL array syntax
      const result = await this.dataSource.query(
        `UPDATE submissions 
         SET status = $1, 
             current_owner_role = $2, 
             review_comments = $3::jsonb,
             "updatedAt" = CURRENT_TIMESTAMP 
         WHERE id = $4
         RETURNING id, status, current_owner_role, review_comments`,
        [
          forwardDto.status,
          UserRole.MOSPI_REVIEWER,
          JSON.stringify(updatedComments), // Pass as JSON string
          id,
        ]
      );

      this.logger.log(`Update result: ${JSON.stringify(result)}`);

      // Step 8: Return updated submission
      const updatedSubmission = await this.findOne(id, userRole, userStateUt);
      this.logger.log(`=== FORWARD TO MOSPI REVIEWER SUCCESS ===`);
      this.logger.log(`Updated submission status: ${updatedSubmission.status}`);
      this.logger.log(
        `Updated current owner role: ${updatedSubmission.currentOwnerRole}`
      );

      return updatedSubmission;
    } catch (error) {
      this.logger.error(`=== FORWARD TO MOSPI REVIEWER ERROR ===`);
      this.logger.error(
        `Error forwarding submission ${id} to MoSPI Reviewer: ${error.message}`
      );
      this.logger.error(`Stack trace: ${error.stack}`);
      throw error;
    }
  }

  // Forward to MoSPI Approver
  async forwardToMoSPIApprover(
    id: string,
    forwardDto: ForwardToMoSPIApproverDto,
    userId: string,
    userRole: UserRole,
    userStateUt: string
  ): Promise<Submission> {
    try {
      this.logger.log(
        `Forwarding submission ${id} to MoSPI Approver by user ${userId}`
      );

      const submission = await this.findOne(id, userRole, userStateUt);

      if (submission.status !== SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER) {
        throw new BadRequestException(
          `Submission must be in SUBMITTED_TO_MOSPI_REVIEWER status to forward to MoSPI Approver. Current status: ${submission.status}`
        );
      }

      // Add comment if provided
      let updatedComments = [...submission.reviewComments];
      if (forwardDto.comment) {
        const comment = this.createComment(
          forwardDto.comment,
          "comment",
          userRole,
          userId,
          forwardDto.sectionId
        );
        updatedComments.push(comment);
      }

      await this.submissionRepository.update(id, {
        status: forwardDto.status,
        currentOwnerRole: UserRole.MOSPI_APPROVER,
        reviewComments: updatedComments,
      });

      const updatedSubmission = await this.findOne(id, userRole, userStateUt);
      this.logger.log(
        `Submission ${id} forwarded to MoSPI Approver successfully`
      );

      return updatedSubmission;
    } catch (error) {
      this.logger.error(
        `Error forwarding submission ${id} to MoSPI Approver: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  // Send back to state
  async sendBackToState(
    id: string,
    sendBackDto: SendBackToStateDto,
    userId: string,
    userRole: UserRole,
    userStateUt: string
  ): Promise<Submission> {
    try {
      this.logger.log(
        `Sending submission ${id} back to state by user ${userId}`
      );

      const submission = await this.findOne(id, userRole, userStateUt);

      if (
        ![
          SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
          SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER,
        ].includes(submission.status)
      ) {
        throw new BadRequestException(
          `Submission must be in MoSPI status to send back to state. Current status: ${submission.status}`
        );
      }

      // Add comment if provided
      let updatedComments = [...submission.reviewComments];
      if (sendBackDto.comment) {
        const comment = this.createComment(
          sendBackDto.comment,
          "comment",
          userRole,
          userId,
          sendBackDto.sectionId
        );
        updatedComments.push(comment);
      }

      await this.submissionRepository.update(id, {
        status: sendBackDto.status,
        currentOwnerRole: UserRole.STATE_APPROVER,
        reviewComments: updatedComments,
        rejectionCount: () => "rejection_count + 1",
      });

      const updatedSubmission = await this.findOne(id, userRole, userStateUt);
      this.logger.log(`Submission ${id} sent back to state successfully`);

      return updatedSubmission;
    } catch (error) {
      this.logger.error(
        `Error sending submission ${id} back to state: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  // Validate status transition
  private validateStatusTransition(
    currentStatus: SubmissionStatus,
    newStatus: SubmissionStatus,
    userRole: UserRole
  ): void {
    const validTransitions = {
      [SubmissionStatus.DRAFT]: [SubmissionStatus.SUBMITTED_TO_STATE],
      [SubmissionStatus.SUBMITTED_TO_STATE]: [
        SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
        SubmissionStatus.REJECTED,
        SubmissionStatus.RETURNED_FROM_STATE,
      ],
      [SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER]: [
        SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER,
        SubmissionStatus.SUBMITTED_TO_STATE,
      ],
      [SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER]: [
        SubmissionStatus.APPROVED,
        SubmissionStatus.REJECTED_FINAL,
        SubmissionStatus.RETURNED_FROM_MOSPI,
        SubmissionStatus.SUBMITTED_TO_STATE,
      ],
      [SubmissionStatus.REJECTED]: [SubmissionStatus.SUBMITTED_TO_STATE],
      [SubmissionStatus.RETURNED_FROM_STATE]: [
        SubmissionStatus.SUBMITTED_TO_STATE,
      ],
      [SubmissionStatus.RETURNED_FROM_MOSPI]: [
        SubmissionStatus.SUBMITTED_TO_STATE,
      ],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}. Please check the workflow rules.`
      );
    }
  }
}
