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
import { Repository, DataSource, In, Not } from "typeorm";
import {
  Submission,
  SubmissionStatus,
  ReviewComment,
  SubmissionFile,
} from "../../entities/submission.entity";
import { UserRole, User } from "../../entities/user.entity";
import { FinalScore } from "../../entities/final-score.entity";
import { UserIndicatorScope } from "../../entities/user-indicator-scope.entity";
import { Indicator } from "../../entities/indicator.entity";
import { ScoringService } from "../scoring/scoring.service";
import { StorageService } from "../storage/storage.service";
import { AuditLog } from "../../entities/audit-log.entity";
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
    @InjectRepository(UserIndicatorScope)
    private userIndicatorScopeRepository: Repository<UserIndicatorScope>,
    @InjectRepository(Indicator)
    private indicatorRepository: Repository<Indicator>,
    private dataSource: DataSource,
    private scoringService: ScoringService,
    private storageService: StorageService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>
  ) {}

  // Helper function to check if a MOSPI reviewer is assigned to a state
  // Handles both single state and comma-separated multiple states
  private async hasMospiReviewerForState(stateUt: string): Promise<boolean> {
    if (!stateUt || !stateUt.trim()) {
      return false;
    }

    // Normalize the state name (trim and lowercase for comparison)
    const normalizedStateUt = stateUt.trim().toLowerCase();

    // Query all MOSPI_REVIEWER users
    const mospiReviewers = await this.userRepository.find({
      where: { role: UserRole.MOSPI_REVIEWER },
      select: ["id", "stateUt"],
    });

    this.logger.log(
      `Checking for MOSPI reviewer for state: ${stateUt}. Found ${mospiReviewers.length} MOSPI reviewers total.`
    );

    // Check if any MOSPI reviewer has this state assigned
    for (const reviewer of mospiReviewers) {
      if (!reviewer.stateUt) {
        continue;
      }

      // Handle comma-separated states (e.g., "Odisha, Maharashtra")
      const assignedStates = reviewer.stateUt
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

      // Check if the submission's state matches any of the reviewer's assigned states
      if (assignedStates.includes(normalizedStateUt)) {
        this.logger.log(
          `Found MOSPI reviewer (ID: ${reviewer.id}) assigned to state: ${stateUt}. Reviewer's assigned states: ${reviewer.stateUt}`
        );
        return true;
      }
    }

    this.logger.warn(
      `No MOSPI reviewer found for state: ${stateUt}. Cannot forward submission.`
    );
    return false;
  }

  // Helper function to get user name
  private async getUserName(userId: string): Promise<string> {
    const user = await this.dataSource
      .getRepository(User)
      .findOne({ where: { id: userId } });

    return user ? `${user.firstName} ${user.lastName}` : "Unknown User";
  }

  // Helper function to filter form data based on user's indicator access
  private async filterFormDataByIndicatorAccess(
    formData: Record<string, any>,
    userId: string,
    userRole: UserRole
  ): Promise<Record<string, any>> {
    // Only filter for NODAL_OFFICER role
    if (userRole !== UserRole.NODAL_OFFICER) {
      return formData;
    }

    try {
      // Get user's assigned indicator codes using raw query
      const userIndicatorScopes = await this.userIndicatorScopeRepository.query(
        `
        SELECT uis.id, uis.user_id as "userId", uis.indicator_id as "indicatorId",
               i.id, i.code, i.indicator_name as name, i.is_active as "isActive"
        FROM user_indicator_scope uis
        LEFT JOIN indicators i ON uis.indicator_id = i.id
        WHERE uis.user_id = $1 AND i.is_active = true
      `,
        [userId]
      );

      const assignedIndicatorCodes = userIndicatorScopes.map(
        (scope) => scope.code
      );

      this.logger.log(
        `User ${userId} assigned indicator codes: ${assignedIndicatorCodes.join(", ")}`
      );

      // Filter form data to only include assigned indicators
      const filteredFormData: Record<string, any> = {};

      for (const [key, value] of Object.entries(formData)) {
        // Check if key matches indicator pattern and is assigned to user
        const indicatorPattern = /^\d+(\.\d+)*$/;
        if (
          indicatorPattern.test(key) &&
          assignedIndicatorCodes.includes(key)
        ) {
          filteredFormData[key] = value;
        } else if (!indicatorPattern.test(key)) {
          // Include non-indicator keys (general form fields)
          filteredFormData[key] = value;
        }
      }

      this.logger.log(
        `Filtered form data keys: ${Object.keys(filteredFormData).join(", ")}`
      );
      return filteredFormData;
    } catch (error) {
      this.logger.error(`Error filtering form data: ${error.message}`);
      // Return original form data if filtering fails
      return formData;
    }
  }

  // Helper function to get user's assigned indicator codes
  private async getUserIndicatorCodes(userId: string): Promise<string[]> {
    const userIndicatorScopes = await this.userIndicatorScopeRepository
      .createQueryBuilder("scope")
      .leftJoinAndSelect("scope.indicator", "indicator")
      .where("scope.userId = :userId", { userId })
      .andWhere("scope.isActive = :isActive", { isActive: true })
      .andWhere("indicator.isActive = :indicatorActive", {
        indicatorActive: true,
      })
      .getMany();

    return userIndicatorScopes.map((scope) => scope.indicator.code);
  }

  // Helper function to filter formData based on user's indicator access
  private async filterFormDataForUser(
    formData: Record<string, any>,
    userId: string,
    userRole: UserRole
  ): Promise<Record<string, any>> {
    // Only filter for NODAL_OFFICER role
    if (userRole !== UserRole.NODAL_OFFICER) {
      return formData;
    }

    const userIndicatorCodes = await this.getUserIndicatorCodes(userId);
    const filteredFormData: Record<string, any> = {};

    // Only include form data for indicators the user has access to
    for (const [key, value] of Object.entries(formData)) {
      if (userIndicatorCodes.includes(key)) {
        filteredFormData[key] = value;
      }
    }

    return filteredFormData;
  }

  // Helper function to create comments with appropriate section ID
  private async createComment(
    text: string,
    type: "comment" | "rejection" | "approval" | "indicator_comment",
    userRole: UserRole,
    userId: string,
    sectionId?: string
  ): Promise<ReviewComment> {
    // Fetch user details to get full name
    const userName = await this.getUserName(userId);

    return {
      timestamp: new Date(),
      role: userRole,
      userId,
      userName,
      text,
      type,
      // If sectionId is provided, use it; otherwise use a default based on comment type
      sectionId:
        sectionId ||
        (type === "comment"
          ? "general"
          : type === "rejection"
            ? "rejection"
            : type === "indicator_comment"
              ? "general"
              : "approval"),
    };
  }

  // Helper function to check if a section has meaningful data or status
  private hasSectionData(sectionData: any, sectionKey?: string, category?: string): boolean {
    if (!sectionData || typeof sectionData !== "object") {
      return false;
    }

    // Normalize sectionData - handle arrays (some sections are stored as arrays)
    const section = Array.isArray(sectionData) ? sectionData[0] : sectionData;
    
    // If section is still not an object, return false
    if (!section || typeof section !== "object") {
      return false;
    }

    // First check: If section has a status field, it means it's been submitted/updated
    // This is a strong indicator that the section should be scored
    if (section.status && typeof section.status === "string" && section.status.trim() !== "") {
      return true;
    }

    // Second check: Check if section has any meaningful data
    const hasData = Object.entries(section).some(([key, value]) => {
      // Skip certain metadata fields that don't indicate actual data
      if (["year", "percentage", "marksObtained", "nodalOfficerId", "status"].includes(key)) {
        return false;
      }

      // Check for meaningful values
      if (value === null || value === undefined || value === "") {
        return false;
      }

      // For arrays, check if they have items
      if (Array.isArray(value)) {
        // Empty arrays don't count as data
        if (value.length === 0) {
          return false;
        }
        // Check if array has meaningful items
        return value.some(item => {
          if (item === null || item === undefined) return false;
          if (typeof item === "object") {
            // For objects in arrays, check if they have any non-empty properties
            return Object.values(item).some(val => {
              if (val === null || val === undefined || val === "") return false;
              if (Array.isArray(val)) return val.length > 0;
              if (typeof val === "object") return Object.keys(val).length > 0;
              return true;
            });
          }
          return true;
        });
      }

      // For numbers, check if they're not 0 (or consider 0 as valid data)
      if (typeof value === "number") {
        return value !== 0;
      }

      // For strings, check if not empty after trim
      if (typeof value === "string") {
        return value.trim() !== "";
      }

      // For boolean values, they always indicate data
      if (typeof value === "boolean") {
        return true;
      }

      // For objects, recursively check
      if (typeof value === "object") {
        return this.hasSectionData(value);
      }

      return true;
    });

    return hasData;
  }

  /**
   * Groups comments by their section numbers (1.1, 1.2, etc.)
   * @param comments The flat array of comments
   * @returns Comments organized by section numbers: { "1.1": [...comments], "1.2": [...comments], etc. }
   */
  public groupCommentsBySection(
    comments: ReviewComment[]
  ): Record<string, ReviewComment[]> {
    if (!Array.isArray(comments) || comments.length === 0) {
      return {};
    }

    const groupedComments: Record<string, ReviewComment[]> = {};

    // Define a more comprehensive section mapping
    const sectionMap = {
      general: "1.1",
      infrastructureMetrics: "1.2",
      budgetAllocation: "1.3",
      projectDetails: "1.4",
      "rejection-reason": "2.1",
      "approval-notes": "2.2",
      qualityMetrics: "1.5",
      performanceMetrics: "1.6",
      finalScores: "2.0",
    };

    // Handle nested section paths
    const prefixMap = {
      "infrastructureMetrics.": "1.2.",
      "qualityMetrics.": "1.5.",
      "performanceMetrics.": "1.6.",
      "projectDetails.": "1.4.",
      "budgetAllocation.": "1.3.",
    };

    // Group comments by section (use section numbers like 1.1, 1.2 etc)
    comments.forEach((comment) => {
      // Determine section number based on sectionId or comment type
      let sectionNumber = "1.1"; // Default section

      if (comment.sectionId) {
        // First check if it's a direct match in our section map
        if (sectionMap[comment.sectionId]) {
          sectionNumber = sectionMap[comment.sectionId];
        } else {
          // Check if it's a nested section using prefix map
          let foundPrefix = false;

          for (const [prefix, sectionPrefix] of Object.entries(prefixMap)) {
            if (comment.sectionId.startsWith(prefix)) {
              // Extract the subsection from the path
              const subsection = comment.sectionId.substring(prefix.length);
              sectionNumber = `${sectionPrefix}${subsection}`;
              foundPrefix = true;
              break;
            }
          }

          // If not found in our maps, check for direct numerical pattern or use default section
          if (!foundPrefix) {
            // Extract section number from sectionId if possible
            const sectionMatch = comment.sectionId.match(/(\d+\.\d+)/);
            sectionNumber = sectionMatch ? sectionMatch[1] : "3.1";
          }
        }
      } else if (comment.type === "rejection") {
        sectionNumber = "2.1";
      } else if (comment.type === "approval") {
        sectionNumber = "2.2";
      }

      // Initialize the array if it doesn't exist
      if (!groupedComments[sectionNumber]) {
        groupedComments[sectionNumber] = [];
      }

      // Add the comment to the appropriate group
      groupedComments[sectionNumber].push({ ...comment });
    });

    return groupedComments;
  }

  // Helper: recursively scan formData, upload detected files to S3, replace file nodes with metadata, and return an attachedFiles array
  private async processAndUploadFiles(
    formData: any,
    submissionId: string
  ): Promise<{ processedFormData: any; attachedFiles: SubmissionFile[] }> {
    const attachedFiles: SubmissionFile[] = [];
    const self = this;

    function isDataUrl(str: any): str is string {
      return typeof str === "string" && /^data:[\w/+.-]+;base64,/.test(str);
    }

    function fileFromDataUrl(
      dataUrl: string,
      suggestedName?: string
    ): Express.Multer.File {
      const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
      if (!m) throw new Error("Invalid data URL");
      const mime = m[1];
      const payload = m[2];
      const buffer = Buffer.from(payload, "base64");
      const originalname = suggestedName || `upload_${Date.now()}`;

      return {
        fieldname: "file",
        originalname,
        encoding: "7bit",
        mimetype: mime,
        size: buffer.length,
        buffer,
        destination: "",
        filename: "",
        path: "",
        stream: undefined as any,
      } as any;
    }

    function looksLikeFileObject(obj: any): boolean {
      if (!obj || typeof obj !== "object") return false;
      if (obj.buffer || obj.path || obj.stream) return true;
      if (obj.fieldname && obj.originalname) return true;
      return false;
    }
    this.logger.debug(
      `processAndUploadFiles() received formData: ${JSON.stringify(formData, null, 2)}`
    );

    async function recurse(node: any, keyPath = ""): Promise<any> {
      if (node == null) return node;

      // 📦 Handle direct data URLs
      if (isDataUrl(node)) {
        const fileObj = fileFromDataUrl(
          node,
          `file_${keyPath.replace(/\W+/g, "_") || Date.now()}`
        );
        const uploaded = await self.storageService.uploadFile(
          fileObj,
          submissionId
        );

        const meta: SubmissionFile = {
          fileName: uploaded.fileName,
          originalName: uploaded.originalName,
          filePath: uploaded.filePath, // ✅ only store path
          fileUrl: "", // 🚫 no signed URL
          fileSize: uploaded.fileSize,
          mimeType: uploaded.mimeType,
          uploadedAt: uploaded.uploadedAt,
        };

        attachedFiles.push(meta);
        return meta; // ✅ replace node with just file path
      }

      if (Array.isArray(node)) {
        return Promise.all(
          node.map((item, i) => recurse(item, `${keyPath}[${i}]`))
        );
      }

      if (typeof node === "object") {
        // ⛔ Skip already-uploaded metadata
        if (
          node.filePath &&
          typeof node.filePath === "string" &&
          !node.fileName
        ) {
          // old-style stored path string — keep as-is (backcompat)
          return node.filePath;
        }
        // if node already looks like metadata (has filePath+fileName), return node itself:
        if (node.filePath && node.fileName) return node;

        // 🧾 Handle nested objects containing a file
        if (
          node.file &&
          (isDataUrl(node.file) || looksLikeFileObject(node.file))
        ) {
          const fileObj = isDataUrl(node.file)
            ? fileFromDataUrl(
                node.file,
                node.originalName || `file_${Date.now()}`
              )
            : node.file;

          const uploaded = await self.storageService.uploadFile(
            fileObj,
            submissionId
          );

          const meta: SubmissionFile = {
            fileName: uploaded.fileName,
            originalName: uploaded.originalName,
            filePath: uploaded.filePath,
            fileUrl: "",
            fileSize: uploaded.fileSize,
            mimeType: uploaded.mimeType,
            uploadedAt: uploaded.uploadedAt,
          };

          attachedFiles.push(meta);
          return uploaded.filePath; // ✅ just store S3 path in formData
        }

        // 📦 Handle raw multer-like file objects
        if (looksLikeFileObject(node)) {
          const uploaded = await self.storageService.uploadFile(
            node as Express.Multer.File,
            submissionId
          );

          const meta: SubmissionFile = {
            fileName: uploaded.fileName,
            originalName: uploaded.originalName,
            filePath: uploaded.filePath,
            fileUrl: "",
            fileSize: uploaded.fileSize,
            mimeType: uploaded.mimeType,
            uploadedAt: uploaded.uploadedAt,
          };

          attachedFiles.push(meta);
          return uploaded.filePath;
        }

        // 🚶 Traverse nested objects
        const out: any = {};
        for (const k of Object.keys(node)) {
          out[k] = await recurse(node[k], keyPath ? `${keyPath}.${k}` : k);
        }
        return out;
      }

      // primitives
      return node;
    }

    const processedFormData = await recurse(formData);
    return { processedFormData, attachedFiles };
  }

  async uploadFile(
    file: Express.Multer.File,
    context: { submissionId: string; path: string }
  ) {
    // Pass ONLY the submissionId to storageService
    // The storageService will construct the path itself: submissions/{submissionId}/{uuid_filename}
    // The 'path' parameter in context is not used here since storageService generates its own filename
    const stored = await this.storageService.uploadFile(
      file,
      context.submissionId
    );
    return stored;
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

      try {
        this.logger.log(JSON.stringify(createSubmissionDto));
      } catch (e) {
        this.logger.error("Failed to stringify DTO: " + e.message);
      }
      // Step 1: Validate user role
      const allowedRoles = [UserRole.NODAL_OFFICER, UserRole.STATE_APPROVER];

      if (!allowedRoles.includes(userRole)) {
        this.logger.error(
          `Invalid user role: ${userRole}. Expected one of: ${allowedRoles.join(", ")}`
        );
        throw new ForbiddenException(
          "Only Nodal Officers or State Approvers can create submissions"
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
      const currentOwnerRole = this.getOwnerRoleFromStatus(status, userRole);

      this.logger.log(
        `Initial Status: ${status}, Owner Role: ${currentOwnerRole}`
      );

      // Step 3.5: Validate MOSPI reviewer assignment if STATE_APPROVER is creating submission with SUBMITTED_TO_MOSPI_REVIEWER status
      if (
        userRole === UserRole.STATE_APPROVER &&
        status === SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER
      ) {
        const hasReviewer = await this.hasMospiReviewerForState(stateUt);
        if (!hasReviewer) {
          this.logger.error(
            `No MOSPI reviewer assigned to state: ${stateUt}. Cannot create submission with SUBMITTED_TO_MOSPI_REVIEWER status.`
          );
          throw new BadRequestException(
            `No MOSPI Reviewer assigned to state: ${stateUt}. Please contact administrator to assign a MOSPI Reviewer to your state before submitting.`
          );
        }
      }

      // Step 4: Create submission
      let processedFormData = createSubmissionDto.formData;
      let newAttachedFiles: SubmissionFile[] = [];

      if (
        Array.isArray((createSubmissionDto as any).attachedFiles) &&
        (createSubmissionDto as any).attachedFiles.length
      ) {
        newAttachedFiles = (createSubmissionDto as any).attachedFiles.map(
          (f: any) => {
            // normalize keys and types; ensure required fileUrl exists; convert uploadedAt -> Date
            const fileUrl = f.fileUrl ?? f.fileurl ?? "";
            const uploadedAtRaw = f.uploadedAt ?? f.uploaded_at ?? null;

            return {
              fileName: f.fileName ?? f.filename ?? "",
              originalName: f.originalName ?? f.originalname ?? "",
              filePath: f.filePath ?? f.filepath ?? "",
              fileUrl:
                typeof fileUrl === "string" ? fileUrl : String(fileUrl || ""),
              fileSize:
                typeof f.fileSize === "number"
                  ? f.fileSize
                  : Number(f.fileSize) || 0,
              mimeType: f.mimeType ?? f.mimetype ?? "",
              uploadedAt:
                uploadedAtRaw instanceof Date
                  ? uploadedAtRaw
                  : uploadedAtRaw
                    ? new Date(uploadedAtRaw)
                    : new Date(),
            } as SubmissionFile;
          }
        );
      }

      // Step 4.5: Initialize section_status based on user's assigned indicators
      // sectionStatus removed: no progress tracking or redirect info
      const submission = this.submissionRepository.create({
        submissionId: createSubmissionDto.submissionId,
        formData: processedFormData,
        submittedBy: userId,
        stateUt,
        status: status,
        currentOwnerRole: currentOwnerRole,
        attachedFiles: newAttachedFiles,
      });

      // Step 5: Save submission
      this.logger.debug(
        "Submission saving payload: " + JSON.stringify(submission, null, 2)
      );

      // after you build "submission" object and before saving:
      this.logger.debug(
        `Mapped attachedFiles count: ${newAttachedFiles.length}`
      );

      let savedSubmission;
      try {
        savedSubmission = await this.submissionRepository.save(submission);
      } catch (saveErr) {
        // rollback uploaded files
        try {
          const filePaths = newAttachedFiles
            .map((f) => f.filePath)
            .filter(Boolean);
          if (filePaths.length) {
            await this.storageService.deleteSubmissionFiles(
              createSubmissionDto.submissionId,
              filePaths
            );
            this.logger.log(
              `Rolled back ${filePaths.length} uploaded files for submission ${createSubmissionDto.submissionId}`
            );
          }
        } catch (delErr) {
          this.logger.error(
            `Failed to cleanup uploaded files after save failure for ${createSubmissionDto.submissionId}: ${delErr.message}`
          );
        }
        throw saveErr;
      }

      this.logger.log(`Submission created successfully: ${savedSubmission.id}`);
      this.logger.log(
        `Final Status: ${savedSubmission.status}, Owner: ${savedSubmission.currentOwnerRole}`
      );

      // Calculate indicator scores for newly created submission
      if (savedSubmission.formData) {
        try {
          this.logger.log(`🔍 Calculating scores for newly created submission ${savedSubmission.id}...`);
          const formData = savedSubmission.formData;
          const categories = ['infraFinancing', 'infraDevelopment', 'pppDevelopment', 'infraEnablers'];
          
          for (const category of categories) {
            const categoryData = formData[category];
            if (!categoryData || typeof categoryData !== 'object') continue;
            
            this.logger.log(`📋 Processing category ${category} with sections: ${Object.keys(categoryData).join(', ')}`);
            
            for (const [sectionKey, sectionData] of Object.entries(categoryData)) {
              if (!sectionKey.startsWith('section')) continue;
              
              // Extract indicator code
              let indicatorCode: string;
              if (sectionKey.startsWith('section')) {
                const match = sectionKey.match(/section(\d+(_\d+)*)/);
                if (match) {
                  indicatorCode = match[1].replace(/_/g, '.');
                } else {
                  indicatorCode = sectionKey.replace('section', '').replace(/_/g, '.');
                }
              } else {
                indicatorCode = sectionKey.replace(/_/g, '.');
              }
              
              // Check if indicator has meaningful data or status before calculating score
              const section = Array.isArray(sectionData) ? sectionData[0] : sectionData;
              const indicatorStatus = section?.status || null;
              
              // Skip empty indicators (no status and no meaningful data)
              if (!indicatorStatus && !this.hasSectionData(sectionData, sectionKey, category)) {
                this.logger.log(`⏭️ Skipping indicator ${indicatorCode} - no status and no meaningful data`);
                continue;
              }
              
              let updateReason = 'INDICATOR_UPDATED';
              if (indicatorStatus === 'SUBMITTED_TO_STATE') {
                updateReason = 'INDICATOR_SUBMITTED';
              } else if (indicatorStatus === 'RESUBMITTED') {
                updateReason = 'INDICATOR_RESUBMITTED';
              } else if (indicatorStatus === 'REVERTED') {
                updateReason = 'INDICATOR_REVERTED';
              }
              
              try {
                this.logger.log(`🧮 Calculating score for indicator ${indicatorCode}...`);
                const calculatedScore = await this.scoringService.calculateIndicatorScore(
                  savedSubmission.id,
                  indicatorCode,
                  category,
                  formData,
                  userId,
                  updateReason,
                  indicatorStatus
                );
                
                this.logger.log(
                  `✅ Calculated and saved score for indicator ${indicatorCode}: ${calculatedScore.score}/${calculatedScore.maxScore}`
                );
              } catch (scoringError) {
                this.logger.error(
                  `❌ Failed to calculate indicator score for ${sectionKey}: ${scoringError.message}`
                );
                this.logger.error(`Error stack: ${scoringError.stack}`);
              }
            }
          }
        } catch (scoringError) {
          this.logger.error(
            `❌ Error calculating scores during create: ${scoringError.message}`
          );
          this.logger.error(`Error stack: ${scoringError.stack}`);
        }
      }

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
      // STATE_APPROVER can see all submissions from their state (all statuses including APPROVED)
      // This includes: SUBMITTED_TO_STATE, SUBMITTED_TO_MOSPI_REVIEWER, SUBMITTED_TO_MOSPI_APPROVER, APPROVED, etc.
      query.andWhere("submission.stateUt = :stateUt", { stateUt: userStateUt });
    } else if (userRole === UserRole.MOSPI_REVIEWER) {
      // MoSPI Reviewer can only see submissions from their assigned state(s)
      // Handle multiple states: userStateUt can be comma-separated like "Odisha, Maharashtra"
      // Split by comma and check if submission's stateUt matches any of the assigned states
      const assignedStates = userStateUt
        ? userStateUt
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      this.logger.log(
        `[MOSPI_REVIEWER] UserId: ${userId}, UserStateUt: ${userStateUt}, AssignedStates: ${JSON.stringify(assignedStates)}`
      );

      if (assignedStates.length > 0) {
        // Use IN clause for multiple states, or exact match for single state
        // Use case-insensitive comparison to handle state name variations
        if (assignedStates.length === 1) {
          query.andWhere(
            "LOWER(TRIM(submission.stateUt)) = LOWER(TRIM(:stateUt))",
            {
              stateUt: assignedStates[0],
            }
          );
        } else {
          // For multiple states, use case-insensitive IN comparison
          const lowerAssignedStates = assignedStates.map((s) =>
            s.toLowerCase()
          );
          query.andWhere(
            "LOWER(TRIM(submission.stateUt)) IN (:...assignedStates)",
            { assignedStates: lowerAssignedStates }
          );
        }
      }
      // If no status filter is provided, default to showing SUBMITTED_TO_MOSPI_REVIEWER, SUBMITTED_TO_MOSPI_APPROVER, and APPROVED
      // This allows MOSPI_REVIEWER to see submissions they need to review, submissions they've forwarded to approver, and approved submissions
      if (!status) {
        query.andWhere("submission.status IN (:...defaultStatuses)", {
          defaultStatuses: [
            SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
            SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER,
            SubmissionStatus.APPROVED,
          ],
        });
      }
    } else if (userRole === UserRole.MOSPI_APPROVER) {
      // MoSPI Approver can see submissions from all states
      // No state filter - they see all submissions submitted to them
      // If no status filter is provided, default to SUBMITTED_TO_MOSPI_APPROVER and APPROVED
      if (!status) {
        query.andWhere("submission.status IN (:...defaultStatuses)", {
          defaultStatuses: [
            SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER,
            SubmissionStatus.APPROVED,
          ],
        });
      }
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

    // Update indicatorComment for each submission
    for (const submission of submissions) {
      if (submission.reviewComments && submission.reviewComments.length > 0) {
        submission.indicatorComment = this.groupCommentsByIndicator(
          submission.reviewComments
        );
      }
    }

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

      // Step 1: Find submission - use query builder to avoid selecting finalScore.category_scores
      const submission = await this.submissionRepository
        .createQueryBuilder("submission")
        .leftJoinAndSelect("submission.user", "user")
        .leftJoin("submission.finalScore", "finalScore")
        .addSelect([
          "finalScore.id",
          "finalScore.submissionId",
          "finalScore.stateUt",
          "finalScore.totalScore",
          "finalScore.scoreBreakdown",
          "finalScore.calculationMethodology",
          "finalScore.approvedBy",
          "finalScore.createdAt",
          "finalScore.updatedAt",
        ])
        .where("submission.id = :id", { id })
        .getOne();

      if (!submission) {
        this.logger.error(`Submission not found with ID: ${id}`);
        throw new NotFoundException("Submission not found");
      }

      this.logger.log(
        `Found submission: ${submission.id}, Status: ${submission.status}, StateUt: ${submission.stateUt}`
      );

      // Step 1.5: Load indicator scores for this submission
      const indicatorScores = await this.scoringService.getSubmissionIndicatorScores(id);
      if (indicatorScores.length > 0) {
        (submission as any).indicatorScores = indicatorScores.map(score => ({
          indicatorCode: score.indicatorCode,
          score: parseFloat(score.score.toString()),
          maxScore: parseFloat(score.maxScore.toString()),
          category: score.category,
          calculation: score.calculation,
          updatedAt: score.updatedAt,
        }));
      }

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

      // Step 3: Update indicatorComment field if needed
      if (submission.reviewComments && submission.reviewComments.length > 0) {
        this.logger.log(`=== UPDATING INDICATOR COMMENT IN FINDONE ===`);
        this.logger.log(
          `Review comments count: ${submission.reviewComments.length}`
        );
        const indicatorComments = this.groupCommentsByIndicator(
          submission.reviewComments
        );
        submission.indicatorComment = indicatorComments;
        this.logger.log(
          `Updated indicatorComment: ${JSON.stringify(submission.indicatorComment)}`
        );
      }

      // Step 4: Filter formData for NODAL_OFFICER based on indicator access
      if (userRole === UserRole.NODAL_OFFICER) {
        this.logger.log(`=== FILTERING FORMDATA FOR NODAL OFFICER ===`);
        const originalFormDataKeys = Object.keys(submission.formData || {});
        submission.formData = await this.filterFormDataByIndicatorAccess(
          submission.formData || {},
          submission.submittedBy,
          userRole
        );
        const filteredFormDataKeys = Object.keys(submission.formData || {});
        this.logger.log(
          `Original formData keys: ${originalFormDataKeys.length}, Filtered keys: ${filteredFormDataKeys.length}`
        );
      }

      // normalizedFormData removed - not needed in response

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

  // Build a flattened indicator-code keyed object from nested category.section structure
  private buildNormalizedFormData(raw: Record<string, any>): {
    byIndicatorCode: Record<string, any>;
    original: Record<string, any>;
  } {
    const byIndicatorCode: Record<string, any> = {};
    if (!raw || typeof raw !== "object") {
      return { byIndicatorCode, original: raw || {} };
    }

    const sectionRegex = /^section(\d+(_\d+)*)$/; // matches section1_1, section2_4, section2_10, section3_2_1 etc.

    for (const [categoryKey, categoryVal] of Object.entries(raw)) {
      if (
        !categoryVal ||
        typeof categoryVal !== "object" ||
        Array.isArray(categoryVal)
      ) {
        continue;
      }
      for (const [sectionKey, sectionVal] of Object.entries(categoryVal)) {
        const m = sectionRegex.exec(sectionKey);
        if (m) {
          const code = m[1].replace(/_/g, "."); // section2_4 -> 2.4, section3_2_1 -> 3.2.1
          // If already present (e.g. direct code storage), merge shallowly preferring existing detailed object
          if (byIndicatorCode[code]) {
            const existing = byIndicatorCode[code];
            if (
              existing &&
              typeof existing === "object" &&
              sectionVal &&
              typeof sectionVal === "object" &&
              !Array.isArray(existing) &&
              !Array.isArray(sectionVal)
            ) {
              byIndicatorCode[code] = { ...sectionVal, ...existing };
            } else {
              // keep existing
            }
          } else {
            byIndicatorCode[code] = sectionVal;
          }
        }
      }
    }

    // Also include any directly stored indicator code objects (e.g., '1.1')
    for (const [key, val] of Object.entries(raw)) {
      if (/^\d+(\.\d+)*$/.test(key) && byIndicatorCode[key] === undefined) {
        byIndicatorCode[key] = val;
      }
    }

    return { byIndicatorCode, original: raw };
  }
  async findByUser(userId: string, role: UserRole, stateUt: string) {
    // Return the most recent non-DRAFT submission for the given user.
    // findOne does not reliably apply order; use find with take:1.
    const submissions = await this.submissionRepository.find({
      where: {
        user: { id: userId },
        status: Not(SubmissionStatus.DRAFT),
      },
      relations: ["user"],
      order: { createdAt: "DESC" },
      take: 1,
    });
    return submissions[0] || null;
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
      if (userRole === UserRole.NODAL_OFFICER) {
        // NODAL_OFFICER can only update their own submissions in DRAFT status
        if (submission.submittedBy !== userId) {
          this.logger.error(
            `Invalid ownership. UserRole: ${userRole}, Owner: ${submission.submittedBy}, UserId: ${userId}`
          );
          throw new ForbiddenException(
            "Only Nodal Officers can update their own submissions"
          );
        }
        if (submission.status !== SubmissionStatus.DRAFT) {
          this.logger.error(
            `Invalid status for update: ${submission.status}. Expected: DRAFT`
          );
          throw new BadRequestException(
            "Cannot update submission that has been submitted"
          );
        }
      } else if (userRole === UserRole.STATE_APPROVER) {
        // STATE_APPROVER can update submissions from their state
        if (submission.stateUt !== userStateUt) {
          this.logger.error(
            `Access denied: submission not in your state. Submission state: ${submission.stateUt}, User state: ${userStateUt}`
          );
          throw new ForbiddenException(
            "Access denied: submission not in your state"
          );
        }
        // Block updates if submission has progressed beyond STATE_APPROVER's control
        const immutableStatuses = [
          SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
          SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER,
          SubmissionStatus.APPROVED,
          SubmissionStatus.REJECTED_FINAL,
        ];
        if (immutableStatuses.includes(submission.status)) {
          this.logger.error(
            `Invalid status for STATE_APPROVER update: ${submission.status}. Submission has progressed beyond state level.`
          );
          throw new BadRequestException(
            `Cannot update submission in status ${submission.status}. Submission has already been forwarded to MoSPI or finalized.`
          );
        }
      } else {
        // Other roles are not allowed to use this update method
        this.logger.error(
          `Invalid user role for update. UserRole: ${userRole}`
        );
        throw new ForbiddenException(
          "Only Nodal Officers and State Approvers can update submissions"
        );
      }

      // Step 4: Merge and update submission form data (preserve existing sections)
      this.logger.log(
        `Updating submission with data: ${JSON.stringify(updateSubmissionDto)}`
      );

      // Deep merge helper to preserve prior nested section data
      const deepMerge = (base: any, incoming: any): any => {
        if (incoming === undefined) return base;
        if (base === undefined) return incoming;
        // Primitive or array replacement
        if (
          typeof base !== "object" ||
          base === null ||
          Array.isArray(base) ||
          typeof incoming !== "object" ||
          incoming === null ||
          Array.isArray(incoming)
        ) {
          return incoming; // replace primitive/array directly
        }
        const merged: Record<string, any> = { ...base };
        for (const k of Object.keys(incoming)) {
          merged[k] = deepMerge(base[k], incoming[k]);
        }
        return merged;
      };

      const updateData: Partial<Submission> = {};

      // Extract attachedFiles from formData if it exists there (should be at top level, but handle both cases)
      let attachedFilesFromFormData: any[] | undefined = undefined;
      if (updateSubmissionDto.formData?.attachedFiles) {
        attachedFilesFromFormData = updateSubmissionDto.formData.attachedFiles;
        // Remove attachedFiles from formData - it should only be in the separate column
        const { attachedFiles: _, ...formDataWithoutAttachedFiles } =
          updateSubmissionDto.formData;
        updateSubmissionDto.formData = formDataWithoutAttachedFiles;
        this.logger.log(
          `Extracted ${attachedFilesFromFormData.length} attachedFiles from formData`
        );
      }

      if (updateSubmissionDto.formData !== undefined) {
        const existingFormData = submission.formData || {};
        const incomingFormData = updateSubmissionDto.formData || {};
        // If section1_2 is present, force full replacement for that section
        if (
          incomingFormData.infraFinancing &&
          incomingFormData.infraFinancing.section1_2
        ) {
          updateData.formData = {
            ...existingFormData,
            infraFinancing: {
              ...existingFormData.infraFinancing,
              ...incomingFormData.infraFinancing,
              section1_2: incomingFormData.infraFinancing.section1_2,
            },
          };
        } else {
          updateData.formData = deepMerge(existingFormData, incomingFormData);
        }
      }
      // sectionStatus removed: no update needed

      // Handle attachedFiles update - store in separate column, not in formData
      // Use attachedFiles from top level OR extracted from formData
      const incomingAttachedFiles =
        updateSubmissionDto.attachedFiles ?? attachedFilesFromFormData;
      if (incomingAttachedFiles !== undefined) {
        const existingAttachedFiles = submission.attachedFiles || [];

        // Normalize incoming attachedFiles
        const normalizedAttachedFiles = incomingAttachedFiles.map((f: any) => {
          const fileUrl = f.fileUrl ?? f.fileurl ?? "";
          const uploadedAtRaw = f.uploadedAt ?? f.uploaded_at ?? null;

          return {
            fileName: f.fileName ?? f.filename ?? "",
            originalName: f.originalName ?? f.originalname ?? "",
            filePath: f.filePath ?? f.filepath ?? "",
            fileUrl:
              typeof fileUrl === "string" ? fileUrl : String(fileUrl || ""),
            fileSize:
              typeof f.fileSize === "number"
                ? f.fileSize
                : Number(f.fileSize) || 0,
            mimeType: f.mimeType ?? f.mimetype ?? "",
            uploadedAt:
              uploadedAtRaw instanceof Date
                ? uploadedAtRaw
                : uploadedAtRaw
                  ? new Date(uploadedAtRaw)
                  : new Date(),
          } as SubmissionFile;
        });

        // Merge with existing files (replace by filePath to avoid duplicates)
        const filePathMap = new Map<string, SubmissionFile>();

        // Add existing files to map
        existingAttachedFiles.forEach((file: any) => {
          if (file.filePath) {
            filePathMap.set(file.filePath, file);
          }
        });

        // Add/update with incoming files
        normalizedAttachedFiles.forEach((file: SubmissionFile) => {
          if (file.filePath) {
            filePathMap.set(file.filePath, file);
          }
        });

        updateData.attachedFiles = Array.from(filePathMap.values());

        this.logger.log(
          `Updating attachedFiles: ${updateData.attachedFiles.length} files (${normalizedAttachedFiles.length} incoming, ${existingAttachedFiles.length} existing)`
        );
      }

      // If STATE_APPROVER is updating, ensure currentOwnerRole is set correctly
      // But don't automatically change status - allow STATE_APPROVER to work on DRAFT submissions
      if (userRole === UserRole.STATE_APPROVER) {
        // Only update currentOwnerRole if it's not already STATE_APPROVER
        if (submission.currentOwnerRole !== UserRole.STATE_APPROVER) {
          updateData.currentOwnerRole = UserRole.STATE_APPROVER;
          this.logger.log(
            `Updating currentOwnerRole to STATE_APPROVER for STATE_APPROVER update`
          );
        }
      }

      await this.submissionRepository.update(id, updateData);

      // Step 5: Return updated submission
      const updatedSubmission = await this.findOne(id, userRole, userStateUt);
      this.logger.log(
        `Submission updated successfully: ${updatedSubmission.id}`
      );

      // Step 5.5: Calculate indicator scores for updated indicators
      this.logger.log(`🔍 Step 5.5: Checking if scoring is needed...`);
      this.logger.log(`updateData.formData exists: ${!!updateData.formData}`);
      this.logger.log(`updatedSubmission.formData exists: ${!!updatedSubmission.formData}`);
      
      if (updateData.formData && updatedSubmission.formData) {
        try {
          const updatedFormData = updatedSubmission.formData;
          const incomingFormData = updateSubmissionDto.formData || {};
          
          this.logger.log(`📊 Calculating scores for updated indicators...`);
          this.logger.log(`Incoming formData categories: ${Object.keys(incomingFormData).join(', ')}`);
          this.logger.log(`Updated formData categories: ${Object.keys(updatedFormData).join(', ')}`);
          
          // Iterate through all categories and sections to calculate scores
          const categories = ['infraFinancing', 'infraDevelopment', 'pppDevelopment', 'infraEnablers'];
          
          for (const category of categories) {
            // Check both incoming and updated formData to find indicators that were updated
            const incomingCategoryData = incomingFormData[category];
            const updatedCategoryData = updatedFormData[category];
            
            // Use incoming data if available (what was actually updated), otherwise use updated data
            const categoryData = incomingCategoryData || updatedCategoryData;
            
            if (!categoryData || typeof categoryData !== 'object') {
              this.logger.log(`⏭️ Skipping category ${category} - no data`);
              continue;
            }
            
            this.logger.log(`📋 Processing category ${category} with sections: ${Object.keys(categoryData).join(', ')}`);
            
            // Find all sections that were updated
            for (const [sectionKey, sectionData] of Object.entries(categoryData)) {
              if (!sectionKey.startsWith('section')) {
                this.logger.log(`⏭️ Skipping ${sectionKey} - not a section`);
                continue;
              }
              
              // Extract indicator code from section key (e.g., "section1_1" -> "1.1")
              let indicatorCode: string;
              if (sectionKey.startsWith('section')) {
                const match = sectionKey.match(/section(\d+(_\d+)*)/);
                if (match) {
                  indicatorCode = match[1].replace(/_/g, '.');
                } else {
                  indicatorCode = sectionKey.replace('section', '').replace(/_/g, '.');
                }
              } else {
                indicatorCode = sectionKey.replace(/_/g, '.');
              }
              
              this.logger.log(`🎯 Processing indicator ${indicatorCode} (section: ${sectionKey})`);
              
              // Determine update reason based on status
              const section = Array.isArray(sectionData) ? sectionData[0] : sectionData;
              const indicatorStatus = section?.status || null;
              
              // Skip empty indicators (no status and no meaningful data)
              if (!indicatorStatus && !this.hasSectionData(sectionData, sectionKey, category)) {
                this.logger.log(`⏭️ Skipping indicator ${indicatorCode} - no status and no meaningful data`);
                continue;
              }
              
              let updateReason = 'INDICATOR_UPDATED';
              if (indicatorStatus === 'SUBMITTED_TO_STATE') {
                updateReason = 'INDICATOR_SUBMITTED';
              } else if (indicatorStatus === 'RESUBMITTED') {
                updateReason = 'INDICATOR_RESUBMITTED';
              } else if (indicatorStatus === 'REVERTED') {
                updateReason = 'INDICATOR_REVERTED';
              }
              
              this.logger.log(`📝 Indicator ${indicatorCode} status: ${indicatorStatus}, reason: ${updateReason}`);
              
              // Calculate and save indicator score
              try {
                this.logger.log(`🧮 Calling calculateIndicatorScore for ${indicatorCode}...`);
                const calculatedScore = await this.scoringService.calculateIndicatorScore(
                  id,
                  indicatorCode,
                  category,
                  updatedFormData,
                  userId,
                  updateReason,
                  indicatorStatus
                );
                
                this.logger.log(
                  `✅ Calculated and saved score for indicator ${indicatorCode} in submission ${id}: ${calculatedScore.score}/${calculatedScore.maxScore}`
                );
              } catch (scoringError) {
                // Log error but don't fail the update
                this.logger.error(
                  `❌ Failed to calculate indicator score for ${sectionKey}: ${scoringError.message}`
                );
                this.logger.error(`Error stack: ${scoringError.stack}`);
              }
            }
          }
        } catch (scoringError) {
          // Log error but don't fail the update
          this.logger.error(
            `❌ Error calculating scores during update: ${scoringError.message}`
          );
          this.logger.error(`Error stack: ${scoringError.stack}`);
        }
      } else {
        this.logger.warn(`⚠️ Skipping score calculation - formData not found in updateData or updatedSubmission`);
      }

      // NEW: Sync STATE_APPROVER's submission when NODAL_OFFICER resubmits an indicator
      // This ensures the STATE_APPROVER's submission (returned from MOSPI) stays in sync
      if (userRole === UserRole.NODAL_OFFICER && updatedSubmission) {
        this.logger.log(
          `🔄 Checking if NODAL_OFFICER submission has RESUBMITTED indicators to sync`
        );

        const updatedFormData = updatedSubmission.formData || {};

        // Check all categories in the updated submission
        for (const [category, categoryData] of Object.entries(
          updatedFormData
        )) {
          if (categoryData && typeof categoryData === "object") {
            // Check all sections in this category for RESUBMITTED status
            for (const [sectionKey, sectionData] of Object.entries(
              categoryData as any
            )) {
              if (sectionKey.startsWith("section")) {
                const section = sectionData as any;
                const sectionStatus = Array.isArray(section)
                  ? section[0]?.status
                  : section?.status;
                const nodalOfficerId = Array.isArray(section)
                  ? section[0]?.nodalOfficerId
                  : section?.nodalOfficerId;

                // If this indicator has RESUBMITTED status and belongs to the current NODAL_OFFICER
                if (
                  sectionStatus === "RESUBMITTED" &&
                  nodalOfficerId &&
                  updatedSubmission.submittedBy === nodalOfficerId &&
                  updatedSubmission.submittedBy === userId
                ) {
                  this.logger.log(
                    `🔄 NODAL_OFFICER resubmitted indicator ${sectionKey} - syncing with STATE_APPROVER's submission`
                  );

                  // Find STATE_APPROVER submissions that:
                  // 1. Have status RETURNED_FROM_MOSPI
                  // 2. Are in the same state
                  // 3. Contain this indicator with matching nodalOfficerId
                  const stateApproverSubmissions =
                    await this.submissionRepository.find({
                      where: {
                        stateUt: updatedSubmission.stateUt,
                        status: SubmissionStatus.RETURNED_FROM_MOSPI,
                        currentOwnerRole: UserRole.STATE_APPROVER,
                      },
                      relations: ["user"],
                      order: { updatedAt: "DESC" },
                    });

                  this.logger.log(
                    `🔍 Found ${stateApproverSubmissions.length} STATE_APPROVER submission(s) with RETURNED_FROM_MOSPI status`
                  );

                  // Find the submission that contains this specific indicator
                  let targetStateApproverSubmission = null;
                  for (const sub of stateApproverSubmissions) {
                    const formData = sub.formData || {};
                    const subCategoryData = formData[category];
                    if (subCategoryData && subCategoryData[sectionKey]) {
                      const subSectionData = subCategoryData[sectionKey];
                      // Check if this section has the matching nodalOfficerId
                      const subSectionNodalId = Array.isArray(subSectionData)
                        ? subSectionData[0]?.nodalOfficerId
                        : subSectionData?.nodalOfficerId;

                      if (subSectionNodalId === nodalOfficerId) {
                        targetStateApproverSubmission = sub;
                        break;
                      }
                    }
                  }

                  if (targetStateApproverSubmission) {
                    this.logger.log(
                      `✅ Found STATE_APPROVER submission ${targetStateApproverSubmission.id} (${targetStateApproverSubmission.submissionId}) for indicator ${sectionKey}`
                    );

                    // Update the STATE_APPROVER's submission with RESUBMITTED status
                    const stateApproverFormData: any =
                      targetStateApproverSubmission.formData
                        ? JSON.parse(
                            JSON.stringify(
                              targetStateApproverSubmission.formData
                            )
                          )
                        : {};

                    // Ensure category and section exist
                    if (
                      !stateApproverFormData[category] ||
                      typeof stateApproverFormData[category] !== "object"
                    ) {
                      stateApproverFormData[category] = {};
                    }
                    if (
                      !stateApproverFormData[category][sectionKey] ||
                      typeof stateApproverFormData[category][sectionKey] !==
                        "object"
                    ) {
                      stateApproverFormData[category][sectionKey] = {};
                    }

                    const targetStateApproverSection =
                      stateApproverFormData[category][sectionKey];

                    // Copy the updated data from NODAL_OFFICER's submission
                    const updatedSectionData = (categoryData as any)[
                      sectionKey
                    ];
                    if (updatedSectionData) {
                      // Merge the updated data while ensuring status is RESUBMITTED
                      Object.assign(
                        targetStateApproverSection,
                        updatedSectionData
                      );
                      targetStateApproverSection.status = "RESUBMITTED"; // Ensure status is RESUBMITTED
                    } else {
                      // If no updated data, just update the status
                      targetStateApproverSection.status = "RESUBMITTED";
                    }

                    this.logger.log(
                      `📝 Syncing indicator ${sectionKey} to RESUBMITTED in STATE_APPROVER submission`
                    );

                    // Update the STATE_APPROVER's submission
                    await this.submissionRepository.update(
                      targetStateApproverSubmission.id,
                      {
                        formData: stateApproverFormData,
                        updatedAt: new Date(),
                      }
                    );

                    this.logger.log(
                      `✅ Synced STATE_APPROVER submission ${targetStateApproverSubmission.id} (${targetStateApproverSubmission.submissionId}) - indicator ${sectionKey} set to RESUBMITTED`
                    );
                  } else {
                    this.logger.warn(
                      `⚠️ Could not find STATE_APPROVER submission for indicator ${sectionKey} with status RETURNED_FROM_MOSPI. Searched ${stateApproverSubmissions.length} submission(s).`
                    );
                  }
                }
              }
            }
          }
        }
      }

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
  ): Promise<{
    status: boolean;
    data: {
      submissions: Submission[];
      total: number;
    };
    message: string;
    timestamp: string;
  }> {
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
      const comment = await this.createComment(
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

      // Step 4: Save updated submission with both reviewComments and indicatorComment
      await this.updateCommentsAndIndicator(id, updatedComments);

      // Step 6: Return updated submission in consistent format
      const updatedSubmission = await this.findOne(id, userRole, userStateUt);
      this.logger.log(
        `Comment added successfully to submission: ${updatedSubmission.id}`
      );
      this.logger.log(`=== ADD COMMENT SUCCESS ===`);

      // Return in same format as findAll
      return {
        status: true,
        data: {
          submissions: [updatedSubmission],
          total: 1,
        },
        message: "Comment added successfully",
        timestamp: new Date().toISOString(),
      };
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
          const userName = await this.getUserName(userId);
          for (const sectionComment of submitDto.sectionComments) {
            const comment: ReviewComment = {
              timestamp: new Date(),
              role: userRole,
              userId,
              userName,
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
          const userName = await this.getUserName(userId);
          const overallComment: ReviewComment = {
            timestamp: new Date(),
            role: userRole,
            userId,
            userName,
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
          indicatorComment: this.groupCommentsByIndicator(updatedComments),
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

      // Handle RETURNED_FROM_MOSPI status by changing it to SUBMITTED_TO_MOSPI_REVIEWER first
      if (submission.status === SubmissionStatus.RETURNED_FROM_MOSPI) {
        console.log(
          "Status is RETURNED_FROM_MOSPI, updating to SUBMITTED_TO_MOSPI_REVIEWER first..."
        );

        // Update submission status to SUBMITTED_TO_MOSPI_REVIEWER
        await this.submissionRepository.update(submission.id, {
          status: SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
          currentOwnerRole: UserRole.MOSPI_REVIEWER,
          updatedAt: new Date(),
        });

        // Update the submission object for further processing
        submission.status = SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER;
        submission.currentOwnerRole = UserRole.MOSPI_REVIEWER;

        console.log(
          "Status updated to SUBMITTED_TO_MOSPI_REVIEWER, continuing with normal flow..."
        );
      } else if (
        submission.status === SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER
      ) {
        console.log(
          "Status is already SUBMITTED_TO_MOSPI_REVIEWER, continuing with normal flow..."
        );
      } else if (submission.status !== SubmissionStatus.SUBMITTED_TO_STATE) {
        console.log("Status check failed - throwing BadRequestException");
        throw new BadRequestException(
          `Submission must be in SUBMITTED_TO_STATE status, but current status is ${submission.status}`
        );
      }

      console.log("Status check passed, checking for MOSPI reviewer...");

      // Validate that a MOSPI reviewer is assigned to this state
      const hasReviewer = await this.hasMospiReviewerForState(
        submission.stateUt
      );
      if (!hasReviewer) {
        this.logger.error(
          `No MOSPI reviewer assigned to state: ${submission.stateUt}. Cannot forward submission.`
        );
        throw new BadRequestException(
          `No MOSPI Reviewer assigned to state: ${submission.stateUt}. Please contact administrator to assign a MOSPI Reviewer to your state before submitting.`
        );
      }

      console.log("MOSPI reviewer check passed, processing comments...");
      // Add comment if provided using helper function
      let updatedComments = [...submission.reviewComments];
      if (forwardDto.comment) {
        const comment = await this.createComment(
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
        indicatorComment: this.groupCommentsByIndicator(updatedComments),
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
        const comment = await this.createComment(
          rejectDto.comment,
          "rejection",
          userRole,
          userId
        );

        this.logger.log(`Adding rejection comment: ${rejectDto.comment}`);

        const updatedComments = [...submission.reviewComments, comment];
        await manager.update(Submission, id, {
          status: rejectDto.status,
          currentOwnerRole: UserRole.NODAL_OFFICER,
          reviewComments: updatedComments,
          indicatorComment: this.groupCommentsByIndicator(updatedComments),
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
        const comment = await this.createComment(
          rejectDto.comment,
          "rejection",
          userRole,
          userId
        );

        this.logger.log(`Adding final rejection comment: ${rejectDto.comment}`);

        const updatedComments = [...submission.reviewComments, comment];
        const updatedSubmission = await manager.save(Submission, {
          ...submission,
          status: rejectDto.status,
          currentOwnerRole: this.getOwnerRoleFromStatus(rejectDto.status),
          reviewComments: updatedComments,
          indicatorComment: this.groupCommentsByIndicator(updatedComments),
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
      if (
        userRole !== UserRole.NODAL_OFFICER &&
        userRole !== UserRole.STATE_APPROVER
      ) {
        this.logger.error(
          `Invalid user role: ${userRole}. Expected: NODAL_OFFICER or STATE_APPROVER`
        );
        throw new ForbiddenException(
          "Only Nodal Officers or State Approvers can resubmit"
        );
      }

      // Step 2: Find submission
      const submission = await this.findOne(id, userRole, userStateUt);
      this.logger.log(`Found submission with status: ${submission.status}`);

      // Step 3: Validate ownership
      // NODAL_OFFICER can only resubmit their own submissions
      // STATE_APPROVER can resubmit submissions from their state
      if (
        userRole === UserRole.NODAL_OFFICER &&
        submission.submittedBy !== userId
      ) {
        this.logger.error(
          `Invalid ownership for NODAL_OFFICER. SubmittedBy: ${submission.submittedBy}, CurrentUser: ${userId}`
        );
        throw new ForbiddenException(
          "Nodal Officers can only resubmit their own submissions"
        );
      }

      if (
        userRole === UserRole.STATE_APPROVER &&
        submission.stateUt !== userStateUt
      ) {
        this.logger.error(
          `Invalid state access for STATE_APPROVER. SubmissionState: ${submission.stateUt}, UserState: ${userStateUt}`
        );
        throw new ForbiddenException(
          "State Approvers can only resubmit submissions from their state"
        );
      }

      // Step 4: Validate submission status
      // Allow resubmission for all statuses except already approved or final rejected ones
      const allowedStatuses = [
        SubmissionStatus.REJECTED,
        SubmissionStatus.DRAFT,
        SubmissionStatus.SUBMITTED_TO_STATE,
        SubmissionStatus.RETURNED_FROM_STATE,
        SubmissionStatus.RETURNED_FROM_MOSPI,
        SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
        SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER,
      ];

      if (!allowedStatuses.includes(submission.status)) {
        this.logger.error(
          `Invalid status for resubmit: ${submission.status}. Allowed statuses: ${allowedStatuses.join(", ")}`
        );
        throw new BadRequestException(
          `Cannot resubmit submissions with status: ${submission.status}`
        );
      }

      // Step 5: Process resubmission in transaction
      this.logger.log(
        `Processing resubmission with rejection count: ${submission.rejectionCount}`
      );
      return this.dataSource.transaction(async (manager) => {
        // Add resubmission comment if provided
        let updatedComments = submission.reviewComments;
        if (resubmitDto.comment) {
          const comment = await this.createComment(
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
          indicatorComment: this.groupCommentsByIndicator(updatedComments),
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
      const comment = await this.createComment(
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
      const indicatorComments = this.groupCommentsByIndicator(updatedComments);
      const result = await this.dataSource.query(
        `UPDATE submissions 
         SET status = $1, 
             current_owner_role = $2, 
             review_comments = $3::jsonb,
             indicator_comment = $4::jsonb,
             "updatedAt" = CURRENT_TIMESTAMP 
         WHERE id = $5
         RETURNING id, status, current_owner_role, review_comments, indicator_comment`,
        [
          approveDto.status,
          this.getOwnerRoleFromStatus(approveDto.status),
          JSON.stringify(updatedComments), // Pass as JSON string
          JSON.stringify(indicatorComments), // Pass indicator comments as JSON string
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
  private getOwnerRoleFromStatus(
    status: SubmissionStatus,
    userRole?: UserRole
  ): UserRole {
    switch (status) {
      case SubmissionStatus.DRAFT:
        // If STATE_APPROVER is creating a DRAFT, keep them as the owner
        if (userRole === UserRole.STATE_APPROVER) {
          return UserRole.STATE_APPROVER;
        }
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
        const comment = await this.createComment(
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
        indicatorComment: this.groupCommentsByIndicator(updatedComments),
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
        const comment = await this.createComment(
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
      const indicatorComments = this.groupCommentsByIndicator(updatedComments);
      const result = await this.dataSource.query(
        `UPDATE submissions 
         SET status = $1, 
             current_owner_role = $2, 
             review_comments = $3::jsonb,
             indicator_comment = $4::jsonb,
             "updatedAt" = CURRENT_TIMESTAMP 
         WHERE id = $5
         RETURNING id, status, current_owner_role, review_comments, indicator_comment`,
        [
          forwardDto.status,
          UserRole.MOSPI_REVIEWER,
          JSON.stringify(updatedComments), // Pass as JSON string
          JSON.stringify(indicatorComments), // Pass indicator comments as JSON string
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
        const comment = await this.createComment(
          forwardDto.comment,
          "comment",
          userRole,
          userId,
          forwardDto.sectionId
        );
        updatedComments.push(comment);
      }

      // Use raw SQL with proper PostgreSQL JSONB array handling (same as forwardToMoSPIReviewer)
      this.logger.log(`Updating submission with status: ${forwardDto.status}`);
      this.logger.log(
        `Review comments to update: ${JSON.stringify(updatedComments)}`
      );

      // Log the exact data being saved
      this.logger.log(`=== DATABASE UPDATE DATA ===`);
      this.logger.log(`Submission ID: ${id}`);
      this.logger.log(`Status: ${forwardDto.status}`);
      this.logger.log(`Current Owner Role: ${UserRole.MOSPI_APPROVER}`);
      this.logger.log(`Review Comments Count: ${updatedComments.length}`);
      this.logger.log(
        `Review Comments JSON: ${JSON.stringify(updatedComments)}`
      );

      // Use raw SQL with proper PostgreSQL array syntax
      const indicatorComments = this.groupCommentsByIndicator(updatedComments);
      const result = await this.dataSource.query(
        `UPDATE submissions 
         SET status = $1, 
             current_owner_role = $2, 
             review_comments = $3::jsonb,
             indicator_comment = $4::jsonb,
             "updatedAt" = CURRENT_TIMESTAMP 
         WHERE id = $5
         RETURNING id, status, current_owner_role, review_comments, indicator_comment`,
        [
          forwardDto.status,
          UserRole.MOSPI_APPROVER,
          JSON.stringify(updatedComments), // Pass as JSON string
          JSON.stringify(indicatorComments), // Pass indicator comments as JSON string
          id,
        ]
      );

      this.logger.log(`Update result: ${JSON.stringify(result)}`);

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
        const comment = await this.createComment(
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
        indicatorComment: this.groupCommentsByIndicator(updatedComments),
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

  /**
   * MoSPI Approver sends submission back to State
   */
  async mospiApproverSendBack(
    submissionId: string,
    // comment: string | undefined,
    userId: string,
    userRole: UserRole,
    userStateUt: string
  ): Promise<Submission> {
    this.logger.log(
      `MoSPI Approver ${userId} sending back submission ${submissionId} to state`
    );

    // Find submission by internal id
    const submission = await this.submissionRepository.findOne({
      where: { id: submissionId },
      relations: ["user", "finalScore"],
    });

    if (!submission) {
      throw new NotFoundException(
        `Submission not found for id: ${submissionId}`
      );
    }

    // Only MoSPI Approver can use this endpoint (guard already enforces this)
    if (userRole !== UserRole.MOSPI_APPROVER) {
      throw new ForbiddenException(
        "Only MoSPI Approver can send back to state"
      );
    }

    // Validate current status (must be with MOSPI Approver)
    if (submission.status !== SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER) {
      throw new BadRequestException(
        `Cannot send back submission in status ${submission.status}. Must be SUBMITTED_TO_MOSPI_APPROVER`
      );
    }

    // Update submission: change status and owner role back to state
    await this.submissionRepository.update(submissionId, {
      status: SubmissionStatus.RETURNED_FROM_MOSPI,
      currentOwnerRole: UserRole.STATE_APPROVER,
      updatedAt: new Date(),
    });

    this.logger.log(
      `Submission ${submissionId} sent back to state by MoSPI Approver successfully`
    );

    // Return updated submission
    return await this.submissionRepository.findOne({
      where: { id: submissionId },
      relations: ["user", "finalScore"],
    });
  }

  async buildCumulativePreview(params: {
    stateUt: string;
    year?: string;
    userRole: UserRole;
    userStateUt?: string;
    debug?: string; // optional ?debug=1
  }) {
    const { stateUt, year, userRole, userStateUt, debug } = params;
    const DEBUG = debug === "1";

    // ---------- Access control ----------
    if (
      userRole !== UserRole.ADMIN &&
      userRole !== UserRole.MOSPI_REVIEWER &&
      userRole !== UserRole.MOSPI_APPROVER &&
      userRole !== UserRole.STATE_APPROVER &&
      userRole !== UserRole.NODAL_OFFICER
    )
      throw new ForbiddenException("Access denied");

    // Normalize state comparison (case-insensitive and trim whitespace)
    const normalizedStateUt = stateUt?.trim().toLowerCase();
    const normalizedUserStateUt = userStateUt?.trim().toLowerCase();

    if (
      userRole === UserRole.STATE_APPROVER &&
      normalizedUserStateUt &&
      normalizedUserStateUt !== normalizedStateUt
    ) {
      this.logger.warn(
        `STATE_APPROVER access denied: userStateUt="${userStateUt}" !== stateUt="${stateUt}"`
      );
      throw new ForbiddenException("You can only preview your own state");
    }

    // ---------- Helpers ----------
    const categoryToParentKey = (category?: string) => {
      switch ((category || "").toLowerCase()) {
        case "infrastructure financing":
          return "infraFinancing";
        case "infrastructure development":
          return "infraDevelopment";
        case "ppp development":
          return "pppDevelopment";
        case "infrastructure enablers":
          return "infraEnablers";
        default:
          return "";
      }
    };
    const codeToSectionKey = (code: string) =>
      `section${String(code).replace(".", "_")}`;
    const deepGet = (obj: any, path: string): any =>
      path
        .split(".")
        .reduce((a, k) => (a && typeof a === "object" ? a[k] : undefined), obj);

    const normalizeYear = (y: any): string | null => {
      if (!y) return null;
      return String(y).trim(); // keep "2025-26" as-is
    };

    const pickSubmissionYear = (s: any): string | null => {
      if (s?.metadata?.fiscalYear) return normalizeYear(s.metadata.fiscalYear);
      if (s?.formData?.meta?.year) return normalizeYear(s.formData.meta.year);
      if (typeof s?.fiscalYear === "string") return normalizeYear(s.fiscalYear);
      if (typeof s?.year === "string") return normalizeYear(s.year);
      if (typeof s?.formData?.year === "string")
        return normalizeYear(s.formData.year);
      return null;
    };

    const pickScalarRecord = (rec: any) =>
      Array.isArray(rec) ? (rec.length ? rec[0] : null) : rec;

    // Find the record for a specific indicator inside a submission
    const findIndicatorPayload = (submission: any, ind: Indicator) => {
      const statuses: any[] | undefined = submission?.statuses;
      const formData = submission?.formData;

      // A) statuses[] (preferred)
      if (Array.isArray(statuses) && statuses.length) {
        const sectionKey = codeToSectionKey(ind.code); // e.g. "section1_1"
        const parentKey = categoryToParentKey(ind.category); // e.g. "infraFinancing"
        const wantPath = parentKey
          ? `${parentKey}.${sectionKey}`.toLowerCase()
          : null;

        if (wantPath) {
          const exact = statuses.find(
            (s) =>
              typeof s?.path === "string" && s.path.toLowerCase() === wantPath
          );
          if (exact) return exact;
        }
        const bySection = statuses.find(
          (s) =>
            (s?.sectionKey || "").toLowerCase() === sectionKey.toLowerCase()
        );
        if (bySection) return bySection;

        const loose = statuses.find(
          (s) =>
            s?.indicatorCode === ind.code ||
            s?.code === ind.code ||
            s?.name === ind.name
        );
        if (loose) return loose;
      }

      // B) legacy formData fallbacks
      if (formData && typeof formData === "object") {
        // Direct lookups by code/id/name
        if (formData[ind.code] != null) return formData[ind.code];
        if (formData[ind.id] != null) return formData[ind.id];
        if (formData[ind.name] != null) return formData[ind.name];

        const sectionKey = codeToSectionKey(ind.code);
        const parents = [
          "infraFinancing",
          "infraDevelopment",
          "pppDevelopment",
          "infraEnablers",
          "infrastructureFinancing",
          "infrastructureDevelopment",
          "infrastructureEnablers",
        ];

        // Try each parent category
        for (const p of parents) {
          const node = deepGet(formData, `${p}.${sectionKey}`);
          // Check if node exists and is not null/undefined
          // Empty objects {} and empty arrays [] are valid - they indicate the section exists
          if (node != null) {
            // Return the full node to preserve status field
            // The status is stored on the node itself (e.g., formData.infraFinancing.section1_1.status)
            return node;
          }
        }

        // Try alternative container paths
        const containerPaths = [
          `sections.${ind.sectionId}.${sectionKey}`,
          `sections.${ind.sectionId}.indicators.${ind.code}`,
          `responses.${ind.code}`,
          `payload.${ind.code}`,
          `data.${ind.code}`,
        ];
        for (const path of containerPaths) {
          const node = deepGet(formData, path);
          if (node != null) {
            // Return the full node to preserve status field
            return node;
          }
        }
      }
      return null;
    };

    const pickIndicatorMeta = (recordIn: any, submission: any) => {
      const rec = pickScalarRecord(recordIn);

      // Extract status: check record first, then submission status, then default to NOT_STARTED
      // The status might be on the record itself (from formData section) or on the submission
      let status = rec?.status;
      if (!status && submission?.formData) {
        // Try to find status in formData structure if not directly on record
        // This handles cases where status is stored separately from data
        const formData = submission.formData;
        if (rec && typeof rec === "object") {
          // Check if record has a code or sectionKey to locate it in formData
          const sectionKey =
            rec.sectionKey || (rec.code ? codeToSectionKey(rec.code) : null);
          const parentKey = rec.parentKey || categoryToParentKey(rec.category);
          if (sectionKey && parentKey) {
            const node = deepGet(formData, `${parentKey}.${sectionKey}`);
            if (node?.status) {
              status = node.status;
            }
          }
        }
      }
      if (!status) {
        status = submission?.status;
      }
      if (!status) {
        status = "NOT_STARTED";
      }

      // Extract year: prioritize year from the record itself (section-level year)
      // This is important because some indicators store year at the section level (e.g., section1_1.year = "2025-26")
      const year = normalizeYear(
        rec?.year ?? rec?.fiscalYear ?? pickSubmissionYear(submission)
      );

      // Extract score: marksObtained takes precedence over score
      const score = rec?.marksObtained ?? rec?.score ?? null;

      // Extract comment: remarks takes precedence over comment
      const comment = rec?.remarks ?? rec?.comment ?? null;

      return {
        status: status as string,
        score,
        comment,
        year,
        updatedAt: rec?.updatedAt ?? submission?.updatedAt ?? null,
      };
    };

    // ---------- 1) Indicators ----------
    const indicators: Indicator[] = await this.indicatorRepository.find({
      where: { isActive: true } as any,
      order: { sectionId: "ASC", code: "ASC" as any },
    });

    // ---------- 2) Submissions for state ----------
    let allSubsRaw: Submission[] = [];
    try {
      // Try case-insensitive comparison for stateUt
      allSubsRaw = await this.submissionRepository
        .createQueryBuilder("s")
        .leftJoinAndSelect("s.statuses", "statuses")
        .where("LOWER(s.stateUt) = LOWER(:stateUt)", { stateUt })
        .getMany();
    } catch (err) {
      this.logger.warn(`Failed to query with join, falling back: ${err}`);
      // Fallback: get all submissions and filter in-memory (case-insensitive)
      const allSubs = await this.submissionRepository.find({
        loadRelationIds: false,
      });
      allSubsRaw = allSubs.filter(
        (s) => s.stateUt && s.stateUt.toLowerCase() === stateUt.toLowerCase()
      );
    }

    this.logger.log(
      `[buildCumulativePreview] Found ${allSubsRaw.length} submissions for stateUt=${stateUt}`
    );
    if (allSubsRaw.length > 0) {
      this.logger.log(
        `[buildCumulativePreview] Sample submission IDs: ${allSubsRaw
          .slice(0, 3)
          .map((s) => s.submissionId)
          .join(", ")}`
      );
      // Log sample formData structure
      const sample = allSubsRaw[0];
      if (sample?.formData) {
        const formDataKeys = Object.keys(sample.formData);
        this.logger.log(
          `[buildCumulativePreview] Sample formData keys: ${formDataKeys.join(", ")}`
        );
        if (formDataKeys.length > 0) {
          const firstKey = formDataKeys[0];
          const firstCategory = sample.formData[firstKey];
          if (firstCategory && typeof firstCategory === "object") {
            const sectionKeys = Object.keys(firstCategory).slice(0, 3);
            this.logger.log(
              `[buildCumulativePreview] Sample ${firstKey} sections: ${sectionKeys.join(", ")}`
            );
          }
        }
      }
    }

    // Year filter in-memory (entity likely has no "year" column)
    const subs = year
      ? allSubsRaw.filter((s) => (pickSubmissionYear(s) ?? "") === String(year))
      : allSubsRaw;

    if (year && subs.length !== allSubsRaw.length) {
      this.logger.log(
        `[buildCumulativePreview] Filtered to ${subs.length} submissions for year=${year}`
      );
    }

    // ---------- 3) Choose best submission per indicator ----------
    const bestByIndicator = new Map<string, Submission | null>();
    const dbg: any = DEBUG
      ? { totals: { submissions: subs.length }, perIndicator: {} }
      : undefined;

    for (const ind of indicators) {
      const candidates = subs.filter((s) => {
        const payload = findIndicatorPayload(s, ind);
        return payload != null;
      });

      // Debug logging for first few indicators
      if (
        ind.code === "1.1" ||
        ind.code === "1.2" ||
        ind.code === "2.1" ||
        DEBUG
      ) {
        this.logger.log(
          `[buildCumulativePreview] Indicator ${ind.code} (${ind.name}): found ${candidates.length} candidate submissions`
        );
        if (candidates.length > 0) {
          const sampleCandidate = candidates[0];
          const samplePayload = findIndicatorPayload(sampleCandidate, ind);
          if (samplePayload) {
            const payloadKeys =
              typeof samplePayload === "object" && !Array.isArray(samplePayload)
                ? Object.keys(samplePayload)
                : ["(not an object)"];
            this.logger.log(
              `[buildCumulativePreview] Indicator ${ind.code}: payload keys (${payloadKeys.length}): ${payloadKeys.slice(0, 10).join(", ")}${payloadKeys.length > 10 ? "..." : ""}`
            );
            if (
              typeof samplePayload === "object" &&
              !Array.isArray(samplePayload)
            ) {
              this.logger.log(
                `[buildCumulativePreview] Indicator ${ind.code}: status=${samplePayload.status || "no status"}, hasData=${Object.keys(samplePayload).filter((k) => !["status", "comment", "remarks", "marksObtained", "score"].includes(k)).length > 0}`
              );
            }
          } else {
            this.logger.log(
              `[buildCumulativePreview] Indicator ${ind.code}: no payload found in candidates`
            );
          }
        } else {
          this.logger.log(
            `[buildCumulativePreview] Indicator ${ind.code}: no candidates found (category: ${ind.category}, sectionKey: ${codeToSectionKey(ind.code)})`
          );
        }
      }

      const accepted = candidates.find((s) => {
        const rec = pickScalarRecord(findIndicatorPayload(s, ind));
        const st = String(
          rec?.status || (s as any)?.status || ""
        ).toUpperCase();
        return (
          st === "ACCEPTED" ||
          st === "APPROVED" ||
          st === "ACCEPTED_BY_STATE_APPROVER"
        );
      });

      const best =
        accepted ??
        (candidates.length
          ? candidates.sort(
              (a, b) =>
                new Date(
                  (b as any).updatedAt || (b as any).createdAt || 0
                ).getTime() -
                new Date(
                  (a as any).updatedAt || (a as any).createdAt || 0
                ).getTime()
            )[0]
          : null);

      bestByIndicator.set(ind.id, best);

      if (DEBUG)
        dbg.perIndicator[ind.code] = {
          candidates: candidates.length,
          pickedAccepted: !!accepted,
        };
    }

    // ---------- 4) Build grouped response ----------
    type PreviewItem = {
      id: string;
      code: string;
      name: string;
      category?: string;
      sectionId?: string;
      maxScore?: number | string;
      data: any;
      status: string;
      score: number | null;
      comment: string | null;
      updatedAt: string | Date | null;
      year: string | null;
    };

    const grouped: Record<string, PreviewItem[]> = {};
    const processedIndicatorIds = new Set<string>();

    // Ensure ALL indicators are included, even if they have no submission data
    for (const ind of indicators) {
      // Track that we're processing this indicator
      processedIndicatorIds.add(ind.id);

      const best = bestByIndicator.get(ind.id) as any;
      const record = best ? findIndicatorPayload(best, ind) : null;
      const meta = pickIndicatorMeta(record, best);

      const category = ind.category || "Uncategorized";
      if (!grouped[category]) grouped[category] = [];

      // Extract data from record - if record has a 'data' property, use that, otherwise use the record itself
      // But exclude status, score, remarks, etc. from the data field (those are in meta)
      let dataField = null;
      if (record) {
        const rec = pickScalarRecord(record);
        if (rec && typeof rec === "object") {
          // If record has a 'data' property, use that
          if ("data" in rec && rec.data != null) {
            dataField = rec.data;
          } else {
            // Otherwise, use the record but exclude metadata fields
            // These are moved to meta: status, score, marksObtained, remarks, comment, updatedAt, year, fiscalYear
            // Everything else (arrays, objects, strings, numbers) should be preserved in data
            const {
              status,
              score,
              marksObtained,
              remarks,
              comment,
              updatedAt,
              year,
              fiscalYear,
              // Also exclude internal metadata fields that might exist
              sectionKey,
              parentKey,
              path,
              indicatorCode,
              code,
              name,
              ...dataOnly
            } = rec;
            // Include all remaining fields as data (preserves arrays, objects, and all other fields)
            // This ensures all database fields like ulbList, infraActArray, file objects, etc. are preserved
            if (Object.keys(dataOnly).length > 0) {
              dataField = dataOnly;
            } else if (Array.isArray(rec)) {
              // If it's an array, preserve it
              dataField = rec;
            }
          }
        } else if (rec != null) {
          // For non-object values (strings, numbers, etc.), preserve them
          dataField = rec;
        }
      }

      // Always include the indicator, even if it has no data
      const previewItem = {
        id: ind.id,
        code: ind.code,
        name: ind.name,
        category: ind.category,
        sectionId: ind.sectionId,
        maxScore: ind.maxScore,
        data: dataField,
        status: meta.status,
        score: meta.score,
        comment: meta.comment,
        updatedAt: meta.updatedAt,
        year: meta.year,
      };

      // Log data field structure for debugging (first few indicators or if DEBUG)
      if (
        (ind.code === "1.1" ||
          ind.code === "1.2" ||
          ind.code === "2.1" ||
          DEBUG) &&
        dataField
      ) {
        const dataKeys =
          typeof dataField === "object" && !Array.isArray(dataField)
            ? Object.keys(dataField)
            : Array.isArray(dataField)
              ? [`[Array with ${dataField.length} items]`]
              : ["(scalar value)"];
        this.logger.log(
          `[buildCumulativePreview] Indicator ${ind.code}: data field contains ${dataKeys.length} keys: ${dataKeys.slice(0, 15).join(", ")}${dataKeys.length > 15 ? "..." : ""}`
        );
      }

      grouped[category].push(previewItem);

      if (DEBUG) {
        Object.assign(dbg.perIndicator[ind.code], {
          foundPayload: !!record,
          status: meta.status,
          score: meta.score,
          year: meta.year,
          dataKeys:
            dataField &&
            typeof dataField === "object" &&
            !Array.isArray(dataField)
              ? Object.keys(dataField).length
              : dataField
                ? 1
                : 0,
        });
      }
    }

    // Validation: Ensure all indicators were processed
    const totalProcessed = processedIndicatorIds.size;
    const totalInGrouped = Object.values(grouped).reduce(
      (sum, arr) => sum + arr.length,
      0
    );

    if (totalProcessed !== indicators.length) {
      this.logger.warn(
        `[buildCumulativePreview] Warning: Processed ${totalProcessed} indicators but expected ${indicators.length}`
      );
    }

    if (totalInGrouped !== indicators.length) {
      this.logger.warn(
        `[buildCumulativePreview] Warning: Grouped ${totalInGrouped} indicators but expected ${indicators.length}`
      );
    }

    this.logger.log(
      `[buildCumulativePreview] Processed ${totalProcessed} indicators, grouped into ${Object.keys(grouped).length} categories: ${Object.keys(grouped).join(", ")}`
    );
    this.logger.log(
      `[buildCumulativePreview] Indicators per category: ${Object.entries(
        grouped
      )
        .map(([cat, items]) => `${cat}: ${items.length}`)
        .join(", ")}`
    );

    // Sort indicators within each category by code for consistent ordering
    for (const category in grouped) {
      grouped[category].sort((a, b) => {
        // Compare by code (e.g., "1.1" < "1.2" < "2.1")
        const codeA = a.code || "";
        const codeB = b.code || "";
        return codeA.localeCompare(codeB, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      });
    }

    // Calculate summary statistics
    const indicatorsWithData = Object.values(grouped)
      .flat()
      .filter((item) => item.data != null).length;
    const indicatorsWithoutData = totalInGrouped - indicatorsWithData;

    this.logger.log(
      `[buildCumulativePreview] Summary: ${indicatorsWithData} indicators with data, ${indicatorsWithoutData} indicators without data`
    );

    // ---------- 5) Return ----------
    return {
      status: true,
      message: `Cumulative preview for ${stateUt}`,
      data: {
        stateUt,
        users: 0, // we're not computing people anymore
        totalIndicators: indicators.length,
        indicatorsInResponse: totalInGrouped, // Should match totalIndicators
        indicatorsWithData,
        indicatorsWithoutData,
        categories: Object.keys(grouped).sort(), // Sort categories alphabetically
        indicators: grouped, // Grouped by category, sorted by code within each category
        ...(DEBUG ? { debug: dbg } : {}),
      },
    };
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

  /**
   * Groups comments by indicator sections (1.1, 1.2, 2.1, etc.)
   * Only groups comments with sectionId matching pattern "X.Y" where X and Y are digits
   */
  private groupCommentsByIndicator(
    comments: ReviewComment[]
  ): Record<string, ReviewComment[]> {
    const indicatorComments: Record<string, ReviewComment[]> = {};

    this.logger.log(`=== GROUPING INDICATOR COMMENTS ===`);
    this.logger.log(`Total comments to process: ${comments.length}`);

    for (const comment of comments) {
      // Check if sectionId matches indicator pattern (X.Y where X and Y are digits)
      // or if it's an indicator_comment type
      const indicatorPattern = /^\d+\.\d+$/;
      const isIndicatorPattern = indicatorPattern.test(comment.sectionId);
      const isIndicatorComment = comment.type === "indicator_comment";

      this.logger.log(
        `Comment: ${comment.text}, SectionId: ${comment.sectionId}, Type: ${comment.type}, IsPattern: ${isIndicatorPattern}, IsIndicatorComment: ${isIndicatorComment}`
      );

      if (isIndicatorPattern || isIndicatorComment) {
        const sectionKey = comment.sectionId;
        if (!indicatorComments[sectionKey]) {
          indicatorComments[sectionKey] = [];
        }
        indicatorComments[sectionKey].push(comment);
        this.logger.log(`Added to section ${sectionKey}`);
      }
    }

    this.logger.log(
      `Final grouped indicator comments: ${JSON.stringify(indicatorComments)}`
    );
    return indicatorComments;
  }

  /**
   * Updates indicatorComment field based on current reviewComments
   */
  private async updateIndicatorComment(submissionId: string): Promise<void> {
    const submission = await this.submissionRepository.findOne({
      where: { id: submissionId },
    });

    if (submission) {
      const indicatorComments = this.groupCommentsByIndicator(
        submission.reviewComments
      );
      await this.submissionRepository.update(submissionId, {
        indicatorComment: indicatorComments,
      });
    }
  }

  /**
   * Updates both reviewComments and indicatorComment fields
   */
  private async updateCommentsAndIndicator(
    submissionId: string,
    reviewComments: ReviewComment[]
  ): Promise<void> {
    const indicatorComments = this.groupCommentsByIndicator(reviewComments);

    await this.submissionRepository.update(submissionId, {
      reviewComments: reviewComments,
      indicatorComment: indicatorComments,
    });
  }

  /**
   * Gets indicator comments for a submission
   */
  async getIndicatorComments(
    id: string,
    userRole: UserRole,
    userStateUt: string
  ): Promise<Record<string, ReviewComment[]>> {
    try {
      this.logger.log(`=== GET INDICATOR COMMENTS START ===`);
      this.logger.log(
        `ID: ${id}, UserRole: ${userRole}, StateUt: ${userStateUt}`
      );

      // Step 1: Find submission
      const submission = await this.findOne(id, userRole, userStateUt);
      this.logger.log(`Found submission with status: ${submission.status}`);

      // Step 2: Update indicatorComment field if needed
      await this.updateIndicatorComment(id);

      // Step 3: Get updated submission with indicatorComment
      const updatedSubmission = await this.submissionRepository.findOne({
        where: { id },
      });

      this.logger.log(`=== GET INDICATOR COMMENTS SUCCESS ===`);
      return updatedSubmission?.indicatorComment || {};
    } catch (error) {
      this.logger.error(`=== GET INDICATOR COMMENTS ERROR ===`);
      this.logger.error(
        `Error getting indicator comments for submission ${id}: ${error.message}`
      );
      this.logger.error(`Stack trace: ${error.stack}`);
      throw error;
    }
  }

  // ...existing code...
  /**
   * Update only specific keys inside submission.formData[category][section]
   * fields: array where each item can be either
   *  - { field: "keyName", value: any }
   *  - { keyName: any }   (single-key object)
   */

  /**
   * Normalize numeric values: return integer if whole number, otherwise preserve up to 2 decimals
   * This prevents unnecessary decimals (e.g., 100.00 becomes 100, but 100.52 stays 100.52)
   */
  private normalizeNumericValue(value: any): any {
    if (value === null || value === undefined || value === "") {
      return value;
    }

    // Convert string to number if it's a numeric string
    const numValue = typeof value === "string" ? parseFloat(value) : value;

    // If not a valid number, return as-is
    if (isNaN(numValue)) {
      return value;
    }

    // Round to 2 decimal places
    const rounded = Math.round(numValue * 100) / 100;

    // If the result is a whole number, return as integer, otherwise return with decimals (up to 2)
    return rounded % 1 === 0 ? Math.round(rounded) : rounded;
  }

  /**
   * Normalize numeric fields in arrays (for bondList, ffiArray, investmentReadyArray, etc.)
   */
  private normalizeArrayNumericFields(arr: any[], fieldNames: string[]): any[] {
    if (!Array.isArray(arr)) {
      return arr;
    }

    return arr.map((item) => {
      if (typeof item !== "object" || item === null) {
        return item;
      }

      const normalized = { ...item };
      for (const fieldName of fieldNames) {
        if (fieldName in normalized) {
          normalized[fieldName] = this.normalizeNumericValue(
            normalized[fieldName]
          );
        }
      }
      return normalized;
    });
  }

  async updateFormSectionFields(
    submissionId: string,
    category: string,
    section: string,
    fields: any[],
    userId: string,
    userRole: UserRole,
    userStateUt: string,
    nodalOfficerId?: string
  ): Promise<Submission> {
    this.logger.log(
      `Updating form section for submissionId=${submissionId} category=${category} section=${section} by user ${userId}`
    );
    this.logger.log(
      `Received ${fields?.length || 0} field(s) to update. Fields structure: ${JSON.stringify(fields, null, 2)}`
    );

    if (!submissionId || !category || !section || !Array.isArray(fields)) {
      throw new BadRequestException(
        "submissionId, category, section and fields[] are required"
      );
    }

    if (nodalOfficerId) {
      this.logger.log(
        `📤 Sending back indicator to NODAL_OFFICER: ${nodalOfficerId}`
      );
    }

    // Use submissionRepository and submissionId (external ID) for all lookups/updates
    const submission = await this.submissionRepository.findOne({
      where: { id: submissionId },
      relations: ["user", "finalScore"],
    });

    if (!submission) {
      throw new NotFoundException(
        `Submission not found for submissionId: ${submissionId}`
      );
    }

    // CRITICAL: Store the original submission status BEFORE any updates
    // This is needed for sync logic that checks the original status
    const originalSubmissionStatus = submission.status;

    // Access checks (performed using repository result)
    // Nodal officer must belong to same state and must be owner
    if (userRole === UserRole.NODAL_OFFICER) {
      if (submission.stateUt !== userStateUt) {
        throw new ForbiddenException(
          "Access denied: submission not in your state"
        );
      }
      if (submission.submittedBy !== userId) {
        throw new ForbiddenException(
          "Nodal Officers can update only their own submissions"
        );
      }
    }

    // State approver must belong to same state
    // MOSPI_APPROVER and MOSPI_REVIEWER can access submissions from any state
    if (
      userRole === UserRole.STATE_APPROVER &&
      submission.stateUt !== userStateUt
    ) {
      throw new ForbiddenException(
        "Access denied: submission not in your state"
      );
    }

    // Check if STATE_APPROVER is accepting or reverting an indicator
    const isAccepting = fields.some((f) => f.status === "ACCEPTED");
    const isReverting = fields.some((f) => f.status === "REVERTED");

    // Store target NODAL_OFFICER submission for accept sync (will be used after main update)
    let targetNodalSubmissionForAccept: Submission | null = null;
    let sectionNodalIdForAccept: string | undefined = undefined;

    // NEW: Prepare for syncing when STATE_APPROVER accepts an indicator
    // We'll do the actual sync after the main submission is updated
    if (userRole === UserRole.STATE_APPROVER && isAccepting) {
      this.logger.log(
        `✅ STATE_APPROVER accepting indicator ${section} - will sync with NODAL_OFFICER's submission after update`
      );

      // Extract nodalOfficerId from the section data
      const sectionData = submission.formData?.[category]?.[section];
      sectionNodalIdForAccept = sectionData
        ? Array.isArray(sectionData)
          ? sectionData[0]?.nodalOfficerId
          : sectionData?.nodalOfficerId
        : undefined;

      if (sectionNodalIdForAccept) {
        // Find the NODAL_OFFICER's submission that contains this indicator
        const nodalOfficerSubmissions = await this.submissionRepository.find({
          where: {
            submittedBy: sectionNodalIdForAccept,
            stateUt: userStateUt,
            status: In([
              SubmissionStatus.DRAFT,
              SubmissionStatus.RETURNED_FROM_STATE,
              SubmissionStatus.SUBMITTED_TO_STATE,
            ]),
          },
          relations: ["user"],
          order: { updatedAt: "DESC" },
        });

        this.logger.log(
          `🔍 Found ${nodalOfficerSubmissions.length} NODAL_OFFICER submission(s) for nodalOfficerId ${sectionNodalIdForAccept}`
        );

        // Find the submission that has this specific section with matching nodalOfficerId
        for (const sub of nodalOfficerSubmissions) {
          const formData = sub.formData || {};
          const categoryData = formData[category];
          if (categoryData && categoryData[section]) {
            const subSectionData = categoryData[section];
            const subSectionNodalId = Array.isArray(subSectionData)
              ? subSectionData[0]?.nodalOfficerId
              : subSectionData?.nodalOfficerId;

            if (subSectionNodalId === sectionNodalIdForAccept) {
              targetNodalSubmissionForAccept = sub;
              break;
            }
          }
        }

        if (targetNodalSubmissionForAccept) {
          this.logger.log(
            `✅ Found NODAL_OFFICER submission ${targetNodalSubmissionForAccept.id} (${targetNodalSubmissionForAccept.submissionId}) for indicator ${section} - will sync after main update`
          );
        } else {
          this.logger.warn(
            `⚠️ Could not find NODAL_OFFICER submission for indicator ${section} with nodalOfficerId ${sectionNodalIdForAccept}. Searched ${nodalOfficerSubmissions.length} submission(s).`
          );
        }
      } else {
        this.logger.warn(
          `⚠️ Could not find nodalOfficerId in section data for indicator ${section}`
        );
      }
    }

    // NEW: Handle sending back to NODAL_OFFICER when STATE_APPROVER sends back
    if (
      userRole === UserRole.STATE_APPROVER &&
      nodalOfficerId &&
      fields.some((f) => f.status === "REVERTED")
    ) {
      this.logger.log(
        `🔄 STATE_APPROVER sending back indicator ${section} to NODAL_OFFICER ${nodalOfficerId}`
      );

      // CRITICAL FIX: Check if the current submission belongs to the NODAL_OFFICER
      // If so, update it directly and preserve the original status
      if (submission.submittedBy === nodalOfficerId) {
        this.logger.log(
          `✅ Current submission belongs to NODAL_OFFICER ${nodalOfficerId} - will update this submission directly`
        );

        // CRITICAL: Store the ORIGINAL status IMMEDIATELY before any updates
        const originalNodalSubmissionStatus = submission.status;

        this.logger.log(
          `🔍 ORIGINAL NODAL_OFFICER submission status: ${originalNodalSubmissionStatus}`
        );
        this.logger.log(
          `🔍 STATE_APPROVER submission status: ${submission.status}`
        );

        // Update the NODAL_OFFICER's submission with REVERTED status
        const nodalFormData: any = submission.formData
          ? JSON.parse(JSON.stringify(submission.formData))
          : {};

        // Ensure category and section exist
        if (
          !nodalFormData[category] ||
          typeof nodalFormData[category] !== "object"
        ) {
          nodalFormData[category] = {};
        }
        if (
          !nodalFormData[category][section] ||
          typeof nodalFormData[category][section] !== "object"
        ) {
          nodalFormData[category][section] = {};
        }

        const targetNodalSection = nodalFormData[category][section];

        // Update status to REVERTED
        targetNodalSection.status = "REVERTED";

        // Determine the status to set based on the ORIGINAL NODAL_OFFICER's submission status
        // If the NODAL_OFFICER's submission was originally DRAFT, keep it as DRAFT
        // If the STATE_APPROVER's submission is RETURNED_FROM_MOSPI, set NODAL_OFFICER's to RETURNED_FROM_STATE
        // Otherwise, default to RETURNED_FROM_STATE
        let newStatusForNodalOfficer: SubmissionStatus;

        // First, check the ORIGINAL NODAL_OFFICER's submission status
        if (originalNodalSubmissionStatus === SubmissionStatus.DRAFT) {
          newStatusForNodalOfficer = SubmissionStatus.DRAFT;
          this.logger.log(
            `📝 ORIGINAL NODAL_OFFICER submission status was DRAFT, keeping status as DRAFT`
          );
        } else if (submission.status === SubmissionStatus.RETURNED_FROM_MOSPI) {
          // If STATE_APPROVER's submission is RETURNED_FROM_MOSPI, set NODAL_OFFICER's to RETURNED_FROM_STATE
          newStatusForNodalOfficer = SubmissionStatus.RETURNED_FROM_STATE;
          this.logger.log(
            `📝 STATE_APPROVER submission is RETURNED_FROM_MOSPI, setting NODAL_OFFICER submission status to RETURNED_FROM_STATE`
          );
        } else {
          // Default behavior: set to RETURNED_FROM_STATE for other cases
          newStatusForNodalOfficer = SubmissionStatus.RETURNED_FROM_STATE;
          this.logger.log(
            `📝 ORIGINAL NODAL_OFFICER submission status was ${originalNodalSubmissionStatus}, defaulting to RETURNED_FROM_STATE`
          );
        }

        this.logger.log(
          `📝 Final status to set for NODAL_OFFICER submission: ${newStatusForNodalOfficer}`
        );

        // Update current_owner_role to NODAL_OFFICER and status based on original submission status
        await this.submissionRepository.update(submission.id, {
          formData: nodalFormData,
          currentOwnerRole: UserRole.NODAL_OFFICER,
          status: newStatusForNodalOfficer,
          updatedAt: new Date(),
        });

        this.logger.log(
          `✅ Updated NODAL_OFFICER submission ${submission.id} (${submission.submissionId}) - indicator ${section} set to REVERTED, status set to ${newStatusForNodalOfficer}`
        );
      } else {
        // Original logic: Search for NODAL_OFFICER's submission
        // Find the NODAL_OFFICER's submission that contains this indicator
        // Look for submissions where:
        // 1. submitted_by = nodalOfficerId
        // 2. stateUt matches
        // 3. formData contains this section with nodalOfficerId matching
        const nodalOfficerSubmissions = await this.submissionRepository.find({
          where: {
            submittedBy: nodalOfficerId,
            stateUt: userStateUt,
            status: In([
              SubmissionStatus.DRAFT,
              SubmissionStatus.RETURNED_FROM_STATE,
              SubmissionStatus.SUBMITTED_TO_STATE,
            ]),
          },
          relations: ["user"],
          order: { updatedAt: "DESC" },
        });

        this.logger.log(
          `🔍 Found ${nodalOfficerSubmissions.length} NODAL_OFFICER submission(s) for nodalOfficerId ${nodalOfficerId}`
        );
        nodalOfficerSubmissions.forEach((sub, index) => {
          this.logger.log(
            `🔍 Submission ${index + 1}: id=${sub.id}, submissionId=${sub.submissionId}, status=${sub.status}`
          );
        });

        // Find the submission that has this specific section with matching nodalOfficerId
        let targetNodalSubmission = null;
        for (const sub of nodalOfficerSubmissions) {
          const formData = sub.formData || {};
          const categoryData = formData[category];
          if (categoryData && categoryData[section]) {
            const sectionData = categoryData[section];
            // Check if this section has the matching nodalOfficerId
            const sectionNodalId = Array.isArray(sectionData)
              ? sectionData[0]?.nodalOfficerId
              : sectionData?.nodalOfficerId;

            if (sectionNodalId === nodalOfficerId) {
              targetNodalSubmission = sub;
              break;
            }
          }
        }

        if (targetNodalSubmission) {
          this.logger.log(
            `✅ Found NODAL_OFFICER submission ${targetNodalSubmission.id} (${targetNodalSubmission.submissionId}) for indicator ${section}`
          );

          // CRITICAL: Store the ORIGINAL status IMMEDIATELY after finding the submission
          // This must be done BEFORE any updates to preserve the original state
          const originalNodalSubmissionStatus = targetNodalSubmission.status;

          this.logger.log(
            `🔍 ORIGINAL NODAL_OFFICER submission status: ${originalNodalSubmissionStatus}`
          );
          this.logger.log(
            `🔍 STATE_APPROVER submission status: ${submission.status}`
          );
          this.logger.log(`🔍 STATE_APPROVER submission id: ${submission.id}`);

          // Update the NODAL_OFFICER's submission with REVERTED status
          const nodalFormData: any = targetNodalSubmission.formData
            ? JSON.parse(JSON.stringify(targetNodalSubmission.formData))
            : {};

          // Ensure category and section exist
          if (
            !nodalFormData[category] ||
            typeof nodalFormData[category] !== "object"
          ) {
            nodalFormData[category] = {};
          }
          if (
            !nodalFormData[category][section] ||
            typeof nodalFormData[category][section] !== "object"
          ) {
            nodalFormData[category][section] = {};
          }

          const targetNodalSection = nodalFormData[category][section];

          // Update status to REVERTED
          targetNodalSection.status = "REVERTED";

          // Determine the status to set based on the ORIGINAL NODAL_OFFICER's submission status
          // If the NODAL_OFFICER's submission was originally DRAFT, keep it as DRAFT
          // If the STATE_APPROVER's submission is RETURNED_FROM_MOSPI, set NODAL_OFFICER's to RETURNED_FROM_STATE
          // Otherwise, default to RETURNED_FROM_STATE
          let newStatusForNodalOfficer: SubmissionStatus;

          // First, check the ORIGINAL NODAL_OFFICER's submission status
          if (originalNodalSubmissionStatus === SubmissionStatus.DRAFT) {
            newStatusForNodalOfficer = SubmissionStatus.DRAFT;
            this.logger.log(
              `📝 ORIGINAL NODAL_OFFICER submission status was DRAFT, keeping status as DRAFT`
            );
          } else if (
            submission.status === SubmissionStatus.RETURNED_FROM_MOSPI
          ) {
            // If STATE_APPROVER's submission is RETURNED_FROM_MOSPI, set NODAL_OFFICER's to RETURNED_FROM_STATE
            newStatusForNodalOfficer = SubmissionStatus.RETURNED_FROM_STATE;
            this.logger.log(
              `📝 STATE_APPROVER submission is RETURNED_FROM_MOSPI, setting NODAL_OFFICER submission status to RETURNED_FROM_STATE`
            );
          } else {
            // Default behavior: set to RETURNED_FROM_STATE for other cases
            newStatusForNodalOfficer = SubmissionStatus.RETURNED_FROM_STATE;
            this.logger.log(
              `📝 ORIGINAL NODAL_OFFICER submission status was ${originalNodalSubmissionStatus}, defaulting to RETURNED_FROM_STATE`
            );
          }

          this.logger.log(
            `📝 Final status to set for NODAL_OFFICER submission: ${newStatusForNodalOfficer}`
          );
          this.logger.log(
            `📝 About to update NODAL_OFFICER submission ${targetNodalSubmission.id} with status ${newStatusForNodalOfficer}`
          );

          // Update current_owner_role to NODAL_OFFICER and status based on original submission status
          await this.submissionRepository.update(targetNodalSubmission.id, {
            formData: nodalFormData,
            currentOwnerRole: UserRole.NODAL_OFFICER,
            status: newStatusForNodalOfficer,
            updatedAt: new Date(),
          });

          this.logger.log(
            `✅ Updated NODAL_OFFICER submission ${targetNodalSubmission.id} (${targetNodalSubmission.submissionId}) - indicator ${section} set to REVERTED, status set to ${newStatusForNodalOfficer}`
          );
        } else {
          this.logger.warn(
            `⚠️ Could not find NODAL_OFFICER submission for indicator ${section} with nodalOfficerId ${nodalOfficerId}. Searched ${nodalOfficerSubmissions.length} submission(s). Will continue with updating current submission.`
          );
          // Continue with updating the current submission anyway
        }
      }
    }

    // Restrict edits once MOSPI processing or final approval/rejection has progressed
    // However, allow MOSPI_REVIEWER to update indicators when status is SUBMITTED_TO_MOSPI_REVIEWER
    // And allow MOSPI_APPROVER to update indicators when status is SUBMITTED_TO_MOSPI_APPROVER
    // And allow STATE_APPROVER to update indicators when status is SUBMITTED_TO_STATE
    const immutableStatuses = [
      SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
      SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER,
      SubmissionStatus.APPROVED,
      SubmissionStatus.REJECTED_FINAL,
    ];

    // Allow roles to update indicators in their respective statuses
    const canUpdateInCurrentStatus =
      (userRole === UserRole.STATE_APPROVER &&
        submission.status === SubmissionStatus.SUBMITTED_TO_STATE) ||
      (userRole === UserRole.STATE_APPROVER &&
        submission.status === SubmissionStatus.RETURNED_FROM_MOSPI) ||
      (userRole === UserRole.MOSPI_REVIEWER &&
        submission.status === SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER) ||
      (userRole === UserRole.MOSPI_APPROVER &&
        submission.status === SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER);

    if (
      immutableStatuses.includes(submission.status) &&
      !canUpdateInCurrentStatus
    ) {
      throw new BadRequestException(
        `Cannot modify submission in status ${submission.status}`
      );
    }

    // Work on a shallow copy of formData to avoid mutating the entity before update
    const newFormData: any = submission.formData
      ? JSON.parse(JSON.stringify(submission.formData))
      : {};

    // Ensure category and section exist
    if (!newFormData[category] || typeof newFormData[category] !== "object") {
      newFormData[category] = {};
    }
    if (
      !newFormData[category][section] ||
      typeof newFormData[category][section] !== "object"
    ) {
      newFormData[category][section] = {};
    }

    const targetSection = newFormData[category][section];

    this.logger.log(
      `Target section before update: ${JSON.stringify(targetSection, null, 2)}`
    );

    // Normalize section to extract indicator code for validation
    const sectionMatch = section.match(/^section(\d+(_\d+)*)$/);
    const currentIndicatorCode = sectionMatch
      ? sectionMatch[1].replace(/_/g, ".")
      : null;

    // Helper to check if a key represents another indicator section
    const isOtherIndicatorSection = (key: string): boolean => {
      const sectionPattern = /^section(\d+(_\d+)*)$/;
      const codePattern = /^\d+(\.\d+)+$/;

      if (sectionPattern.test(key)) {
        const match = key.match(sectionPattern);
        if (match && currentIndicatorCode) {
          const keyIndicatorCode = match[1].replace(/_/g, ".");
          return keyIndicatorCode !== currentIndicatorCode;
        }
      }
      if (codePattern.test(key) && currentIndicatorCode) {
        return key !== currentIndicatorCode;
      }
      return false;
    };

    // Apply each provided field update (only update explicit keys)
    for (const item of fields) {
      if (item && typeof item === "object") {
        // Accept multi-key objects: { key1: value1, key2: value2, ... }
        const keys = Object.keys(item);
        if (keys.length >= 1) {
          for (const key of keys) {
            // CRITICAL: Skip any keys that represent other indicator sections
            // This prevents accidentally saving data from other indicators into the current section
            if (isOtherIndicatorSection(key)) {
              this.logger.warn(
                `⚠️ Skipping field '${key}' - it belongs to a different indicator. ` +
                  `Current indicator: ${currentIndicatorCode || section}, Skipped key: ${key}`
              );
              continue;
            }

            // If value is an object, check for nested section data from other indicators
            if (
              item[key] &&
              typeof item[key] === "object" &&
              !Array.isArray(item[key])
            ) {
              const nestedKeys = Object.keys(item[key]);
              const hasOtherSectionData = nestedKeys.some((nestedKey) =>
                isOtherIndicatorSection(nestedKey)
              );

              if (hasOtherSectionData) {
                this.logger.warn(
                  `⚠️ Skipping nested field '${key}' - it contains data for other indicators. ` +
                    `Current indicator: ${currentIndicatorCode || section}`
                );
                continue;
              }
            }

            // Normalize numeric fields for specific indicators
            let normalizedValue = item[key];

            // Handle nested objects that may contain arrays or numeric fields
            if (
              normalizedValue &&
              typeof normalizedValue === "object" &&
              !Array.isArray(normalizedValue)
            ) {
              // Create a copy to avoid mutating the original
              normalizedValue = { ...normalizedValue };

              // Indicator 1.4: Value (INR - values is in CRORES) in bondList array
              if (
                "bondList" in normalizedValue &&
                Array.isArray(normalizedValue.bondList)
              ) {
                normalizedValue.bondList = this.normalizeArrayNumericFields(
                  normalizedValue.bondList,
                  ["value"]
                );
              }

              // Indicator 1.5: Total Funding (INR) in ffiArray
              if (
                "ffiArray" in normalizedValue &&
                Array.isArray(normalizedValue.ffiArray)
              ) {
                normalizedValue.ffiArray = this.normalizeArrayNumericFields(
                  normalizedValue.ffiArray,
                  ["totalFunding"]
                );
              }

              // Indicator 2.4: Project Size (INR - values is in CRORES) in investmentReadyArray
              if (
                "investmentReadyArray" in normalizedValue &&
                Array.isArray(normalizedValue.investmentReadyArray)
              ) {
                normalizedValue.investmentReadyArray =
                  this.normalizeArrayNumericFields(
                    normalizedValue.investmentReadyArray,
                    ["projectSize"]
                  );
              }

              // Indicator 3.4: Total Project Cost (INR - values is in CRORES)
              if ("totalTPC" in normalizedValue) {
                normalizedValue.totalTPC = this.normalizeNumericValue(
                  normalizedValue.totalTPC
                );
              }
              if ("tpcOfPPPProjects" in normalizedValue) {
                normalizedValue.tpcOfPPPProjects = this.normalizeNumericValue(
                  normalizedValue.tpcOfPPPProjects
                );
              }
            } else {
              // Handle direct array fields
              // Indicator 1.4: Value (INR - values is in CRORES) in bondList array
              if (key === "bondList" && Array.isArray(normalizedValue)) {
                normalizedValue = this.normalizeArrayNumericFields(
                  normalizedValue,
                  ["value"]
                );
              }

              // Indicator 1.5: Total Funding (INR) in ffiArray
              if (key === "ffiArray" && Array.isArray(normalizedValue)) {
                normalizedValue = this.normalizeArrayNumericFields(
                  normalizedValue,
                  ["totalFunding"]
                );
              }

              // Indicator 2.4: Project Size (INR - values is in CRORES) in investmentReadyArray
              if (
                key === "investmentReadyArray" &&
                Array.isArray(normalizedValue)
              ) {
                normalizedValue = this.normalizeArrayNumericFields(
                  normalizedValue,
                  ["projectSize"]
                );
              }

              // Indicator 3.4: Total Project Cost (INR - values is in CRORES)
              if (key === "totalTPC" || key === "tpcOfPPPProjects") {
                normalizedValue = this.normalizeNumericValue(normalizedValue);
              }
            }

            // If value is array and targetSection[key] is array, replace it
            if (
              Array.isArray(normalizedValue) &&
              Array.isArray(targetSection[key])
            ) {
              targetSection[key] = [...normalizedValue];
            } else {
              targetSection[key] = normalizedValue;
            }
          }
          continue;
        }
      }
      // unsupported shape
      throw new BadRequestException(
        "Each field must be an object with one or more key-value pairs"
      );
    }

    // After processing all fields, set status to SUBMITTED_TO_STATE if not explicitly provided
    // Check if status was explicitly provided in the fields array
    let statusWasProvided = false;
    for (const item of fields) {
      if (item && typeof item === "object" && item.status !== undefined) {
        statusWasProvided = true;
        break;
      }
    }

    // If status was not explicitly provided in the fields, set it to SUBMITTED_TO_STATE
    // This ensures that when a user saves/submits an indicator, it gets marked as submitted to state
    if (!statusWasProvided) {
      targetSection.status = "SUBMITTED_TO_STATE";
      this.logger.log(
        `Set indicator status to SUBMITTED_TO_STATE for ${category}.${section}`
      );
    } else {
      this.logger.log(
        `Status was explicitly provided in fields, keeping: ${targetSection.status} for ${category}.${section}`
      );
    }

    // Normalize section parameter (e.g., "section2_3", "2.3", etc. -> "section2_3")
    // The section parameter should be the section key, not the category
    const rawSection = section?.trim();
    let sectionKey: string;
    if (/^section\d+(_\d+)*$/.test(rawSection)) {
      sectionKey = rawSection; // already normalized (e.g., "section2_3")
    } else if (/^\d+(\.\d+)*$/.test(rawSection)) {
      sectionKey = `section${rawSection.replace(/\./g, "_")}`; // convert dotted code (e.g., "2.3" -> "section2_3")
    } else {
      // Fallback: assume it's already a section key or sanitize
      sectionKey = rawSection.startsWith('section') ? rawSection : `section_${rawSection.replace(/[^a-zA-Z0-9]+/g, "_")}`;
    }
    this.logger.log(
      `🔎 Normalizing section='${rawSection}' -> sectionKey='${sectionKey}' (category='${category}')`
    );

    // sectionStatus removed: no normalization, progress tracking, or persistence
    await this.submissionRepository.update(submission.id, {
      formData: newFormData,
      updatedAt: new Date(),
    });

    this.logger.log(
      `Updated formData category=${category} section=${section} for submissionId=${submissionId}`
    );
    this.logger.log(
      `Target section after update: ${JSON.stringify(targetSection, null, 2)}`
    );
    this.logger.log(
      `All sections in category ${category}: ${JSON.stringify(Object.keys(newFormData[category] || {}))}`
    );

    // Return fresh submission loaded via repository (using submissionId)
    const refreshed = await this.submissionRepository.findOne({
      where: { id: submissionId },
      relations: ["user", "finalScore"],
    });

    if (!refreshed) {
      // unlikely, but handle defensively
      throw new NotFoundException(
        `Submission not found after update: ${submissionId}`
      );
    }

    // Calculate and save indicator score after updating formData
    let calculatedScore: any = null;
    try {
      // Extract indicator code from section key (e.g., "section1_1" -> "1.1")
      // sectionKey is already normalized (e.g., "section1_1", "section2_3", etc.)
      let indicatorCode: string;
      if (sectionKey.startsWith('section')) {
        // Extract number pattern and convert underscores to dots
        const match = sectionKey.match(/section(\d+(_\d+)*)/);
        if (match) {
          indicatorCode = match[1].replace(/_/g, '.');
        } else {
          // Fallback: try to extract from sectionKey
          indicatorCode = sectionKey.replace('section', '').replace(/_/g, '.');
        }
      } else {
        // If section is already in code format (e.g., "1.1")
        indicatorCode = sectionKey.replace(/_/g, '.');
      }
      
      // Determine update reason based on status
      const targetSection = newFormData[category]?.[sectionKey];
      const indicatorStatus = targetSection?.status || null;
      
      // Always calculate score if indicator has status OR has data
      // This ensures scores are updated whenever an indicator is modified
      const hasData = this.hasSectionData(targetSection, sectionKey, category);
      const shouldCalculateScore = indicatorStatus || hasData;
      
      if (!shouldCalculateScore) {
        this.logger.log(`⏭️ Skipping indicator ${indicatorCode} - no status and no meaningful data`);
      } else {
        let updateReason = 'INDICATOR_UPDATED';
        if (indicatorStatus === 'SUBMITTED_TO_STATE') {
          updateReason = 'INDICATOR_SUBMITTED';
        } else if (indicatorStatus === 'RESUBMITTED') {
          updateReason = 'INDICATOR_RESUBMITTED';
        } else if (indicatorStatus === 'REVERTED') {
          updateReason = 'INDICATOR_REVERTED';
        }

        this.logger.log(
          `🧮 Calculating score for indicator ${indicatorCode} (status: ${indicatorStatus || 'none'}, hasData: ${hasData}, reason: ${updateReason})`
        );

        // Calculate and save indicator score with history tracking
        calculatedScore = await this.scoringService.calculateIndicatorScore(
          submissionId,
          indicatorCode,
          category,
          refreshed.formData,
          userId,
          updateReason,
          indicatorStatus
        );
        
        this.logger.log(
          `✅ Calculated and saved score (with history) for indicator ${indicatorCode} in submission ${submissionId}: ${calculatedScore.score}/${calculatedScore.maxScore}`
        );
      }
    } catch (scoringError) {
      // Log error but don't fail the update
      this.logger.error(
        `Failed to calculate indicator score for ${sectionKey}: ${scoringError.message}`
      );
      this.logger.error(`Scoring error stack: ${scoringError.stack}`);
    }

    // NEW: Sync NODAL_OFFICER's submission when STATE_APPROVER accepts an indicator
    // This must be done AFTER the main submission is updated to get the latest data
    if (
      userRole === UserRole.STATE_APPROVER &&
      isAccepting &&
      targetNodalSubmissionForAccept
    ) {
      this.logger.log(
        `🔄 Syncing ACCEPTED status to NODAL_OFFICER submission ${targetNodalSubmissionForAccept.id}`
      );

      // Update the NODAL_OFFICER's submission with ACCEPTED status and updated data
      const nodalFormData: any = targetNodalSubmissionForAccept.formData
        ? JSON.parse(JSON.stringify(targetNodalSubmissionForAccept.formData))
        : {};

      // Ensure category and section exist
      if (
        !nodalFormData[category] ||
        typeof nodalFormData[category] !== "object"
      ) {
        nodalFormData[category] = {};
      }
      if (
        !nodalFormData[category][section] ||
        typeof nodalFormData[category][section] !== "object"
      ) {
        nodalFormData[category][section] = {};
      }

      const targetNodalSection = nodalFormData[category][section];

      // Copy the updated data from STATE_APPROVER's refreshed submission
      const updatedSectionData = refreshed.formData?.[category]?.[section];
      if (updatedSectionData) {
        // Merge the updated data while ensuring status is ACCEPTED
        Object.assign(targetNodalSection, updatedSectionData);
        targetNodalSection.status = "ACCEPTED"; // Ensure status is ACCEPTED
      } else {
        // If no updated data, just update the status
        targetNodalSection.status = "ACCEPTED";
      }

      this.logger.log(
        `📝 Syncing indicator ${section} to ACCEPTED in NODAL_OFFICER submission with updated data`
      );

      // Update the NODAL_OFFICER's submission
      await this.submissionRepository.update(
        targetNodalSubmissionForAccept.id,
        {
          formData: nodalFormData,
          updatedAt: new Date(),
        }
      );

      this.logger.log(
        `✅ Synced NODAL_OFFICER submission ${targetNodalSubmissionForAccept.id} (${targetNodalSubmissionForAccept.submissionId}) - indicator ${section} set to ACCEPTED`
      );

      // NEW: Always sync to RETURNED_FROM_MOSPI submission when accepting (if it exists)
      // This ensures that when STATE_APPROVER accepts from ANY form (DRAFT, SUBMITTED_TO_STATE, etc.),
      // it also reflects in the form that came from MOSPI (RETURNED_FROM_MOSPI)
      // Only skip if we're already accepting from RETURNED_FROM_MOSPI (to avoid duplicate sync)
      if (
        originalSubmissionStatus !== SubmissionStatus.RETURNED_FROM_MOSPI &&
        sectionNodalIdForAccept
      ) {
        this.logger.log(
          `🔄 STATE_APPROVER accepting from ${originalSubmissionStatus} submission - also syncing to RETURNED_FROM_MOSPI submission`
        );

        // Find STATE_APPROVER submissions that:
        // 1. Have status RETURNED_FROM_MOSPI
        // 2. Are in the same state
        // 3. Contain this indicator with matching nodalOfficerId
        const stateApproverSubmissions = await this.submissionRepository.find({
          where: {
            stateUt: userStateUt,
            status: SubmissionStatus.RETURNED_FROM_MOSPI,
            currentOwnerRole: UserRole.STATE_APPROVER,
          },
          relations: ["user"],
          order: { updatedAt: "DESC" },
        });

        this.logger.log(
          `🔍 Found ${stateApproverSubmissions.length} STATE_APPROVER submission(s) with RETURNED_FROM_MOSPI status`
        );

        // Find the submission that contains this specific indicator
        let targetStateApproverSubmission = null;
        for (const sub of stateApproverSubmissions) {
          const formData = sub.formData || {};
          const categoryData = formData[category];
          if (categoryData && categoryData[section]) {
            const subSectionData = categoryData[section];
            // Check if this section has the matching nodalOfficerId
            const subSectionNodalId = Array.isArray(subSectionData)
              ? subSectionData[0]?.nodalOfficerId
              : subSectionData?.nodalOfficerId;

            if (subSectionNodalId === sectionNodalIdForAccept) {
              targetStateApproverSubmission = sub;
              break;
            }
          }
        }

        if (targetStateApproverSubmission) {
          this.logger.log(
            `✅ Found STATE_APPROVER RETURNED_FROM_MOSPI submission ${targetStateApproverSubmission.id} (${targetStateApproverSubmission.submissionId}) for indicator ${section}`
          );

          // Update the STATE_APPROVER's RETURNED_FROM_MOSPI submission with ACCEPTED status
          const stateApproverFormData: any =
            targetStateApproverSubmission.formData
              ? JSON.parse(
                  JSON.stringify(targetStateApproverSubmission.formData)
                )
              : {};

          // Ensure category and section exist
          if (
            !stateApproverFormData[category] ||
            typeof stateApproverFormData[category] !== "object"
          ) {
            stateApproverFormData[category] = {};
          }
          if (
            !stateApproverFormData[category][section] ||
            typeof stateApproverFormData[category][section] !== "object"
          ) {
            stateApproverFormData[category][section] = {};
          }

          const targetStateApproverSection =
            stateApproverFormData[category][section];

          // Copy the updated data from STATE_APPROVER's refreshed submission
          if (updatedSectionData) {
            // Merge the updated data while ensuring status is ACCEPTED
            Object.assign(targetStateApproverSection, updatedSectionData);
            targetStateApproverSection.status = "ACCEPTED"; // Ensure status is ACCEPTED
          } else {
            // If no updated data, just update the status
            targetStateApproverSection.status = "ACCEPTED";
          }

          this.logger.log(
            `📝 Syncing indicator ${section} to ACCEPTED in STATE_APPROVER RETURNED_FROM_MOSPI submission`
          );

          // Update the STATE_APPROVER's RETURNED_FROM_MOSPI submission
          await this.submissionRepository.update(
            targetStateApproverSubmission.id,
            {
              formData: stateApproverFormData,
              updatedAt: new Date(),
            }
          );

          this.logger.log(
            `✅ Synced STATE_APPROVER RETURNED_FROM_MOSPI submission ${targetStateApproverSubmission.id} (${targetStateApproverSubmission.submissionId}) - indicator ${section} set to ACCEPTED`
          );
        } else {
          this.logger.warn(
            `⚠️ Could not find STATE_APPROVER RETURNED_FROM_MOSPI submission for indicator ${section} with nodalOfficerId ${sectionNodalIdForAccept}. Searched ${stateApproverSubmissions.length} submission(s).`
          );
        }
      } else if (
        originalSubmissionStatus === SubmissionStatus.RETURNED_FROM_MOSPI
      ) {
        this.logger.log(
          `ℹ️ Accepting from RETURNED_FROM_MOSPI submission - skipping RETURNED_FROM_MOSPI sync (already updating that form)`
        );
      }

      // NEW: Also sync to SUBMITTED_TO_STATE submission if accepting from RETURNED_FROM_MOSPI
      // This ensures bidirectional sync - when STATE_APPROVER accepts from RETURNED_FROM_MOSPI,
      // it also reflects in the SUBMITTED_TO_STATE submission
      if (originalSubmissionStatus === SubmissionStatus.RETURNED_FROM_MOSPI) {
        this.logger.log(
          `🔍 Original submission status was RETURNED_FROM_MOSPI - will sync to SUBMITTED_TO_STATE submission`
        );
        this.logger.log(
          `🔄 STATE_APPROVER accepting from RETURNED_FROM_MOSPI submission - also syncing to SUBMITTED_TO_STATE submission`
        );

        // Find STATE_APPROVER submissions that:
        // 1. Have status SUBMITTED_TO_STATE
        // 2. Are in the same state
        // 3. Contain this indicator with matching nodalOfficerId
        const stateApproverSubmissions = await this.submissionRepository.find({
          where: {
            stateUt: userStateUt,
            status: SubmissionStatus.SUBMITTED_TO_STATE,
            currentOwnerRole: UserRole.STATE_APPROVER,
          },
          relations: ["user"],
          order: { updatedAt: "DESC" },
        });

        this.logger.log(
          `🔍 Found ${stateApproverSubmissions.length} STATE_APPROVER submission(s) with SUBMITTED_TO_STATE status`
        );

        // Find the submission that contains this specific indicator
        let targetStateApproverSubmission = null;
        for (const sub of stateApproverSubmissions) {
          const formData = sub.formData || {};
          const categoryData = formData[category];
          if (categoryData && categoryData[section]) {
            const subSectionData = categoryData[section];
            // Check if this section has the matching nodalOfficerId
            const subSectionNodalId = Array.isArray(subSectionData)
              ? subSectionData[0]?.nodalOfficerId
              : subSectionData?.nodalOfficerId;

            if (subSectionNodalId === sectionNodalIdForAccept) {
              targetStateApproverSubmission = sub;
              break;
            }
          }
        }

        if (targetStateApproverSubmission) {
          this.logger.log(
            `✅ Found STATE_APPROVER SUBMITTED_TO_STATE submission ${targetStateApproverSubmission.id} (${targetStateApproverSubmission.submissionId}) for indicator ${section}`
          );

          // Update the STATE_APPROVER's SUBMITTED_TO_STATE submission with ACCEPTED status
          const stateApproverFormData: any =
            targetStateApproverSubmission.formData
              ? JSON.parse(
                  JSON.stringify(targetStateApproverSubmission.formData)
                )
              : {};

          // Ensure category and section exist
          if (
            !stateApproverFormData[category] ||
            typeof stateApproverFormData[category] !== "object"
          ) {
            stateApproverFormData[category] = {};
          }
          if (
            !stateApproverFormData[category][section] ||
            typeof stateApproverFormData[category][section] !== "object"
          ) {
            stateApproverFormData[category][section] = {};
          }

          const targetStateApproverSection =
            stateApproverFormData[category][section];

          // Copy the updated data from STATE_APPROVER's refreshed submission
          if (updatedSectionData) {
            // Merge the updated data while ensuring status is ACCEPTED
            Object.assign(targetStateApproverSection, updatedSectionData);
            targetStateApproverSection.status = "ACCEPTED"; // Ensure status is ACCEPTED
          } else {
            // If no updated data, just update the status
            targetStateApproverSection.status = "ACCEPTED";
          }

          this.logger.log(
            `📝 Syncing indicator ${section} to ACCEPTED in STATE_APPROVER SUBMITTED_TO_STATE submission`
          );

          // Update the STATE_APPROVER's SUBMITTED_TO_STATE submission
          await this.submissionRepository.update(
            targetStateApproverSubmission.id,
            {
              formData: stateApproverFormData,
              updatedAt: new Date(),
            }
          );

          this.logger.log(
            `✅ Synced STATE_APPROVER SUBMITTED_TO_STATE submission ${targetStateApproverSubmission.id} (${targetStateApproverSubmission.submissionId}) - indicator ${section} set to ACCEPTED`
          );
        } else {
          this.logger.warn(
            `⚠️ Could not find STATE_APPROVER SUBMITTED_TO_STATE submission for indicator ${section} with nodalOfficerId ${sectionNodalIdForAccept}. Searched ${stateApproverSubmissions.length} submission(s).`
          );
        }
      }
    }

    // NEW: Sync STATE_APPROVER's submission when NODAL_OFFICER resubmits an indicator
    // This ensures the STATE_APPROVER's submission (returned from MOSPI) stays in sync
    if (
      userRole === UserRole.NODAL_OFFICER &&
      fields.some((f) => f.status === "RESUBMITTED")
    ) {
      this.logger.log(
        `🔄 NODAL_OFFICER resubmitted indicator ${section} - syncing with STATE_APPROVER's submission`
      );

      // Find STATE_APPROVER submissions that:
      // 1. Have status RETURNED_FROM_MOSPI
      // 2. Are in the same state
      // 3. Contain this indicator with matching nodalOfficerId
      const stateApproverSubmissions = await this.submissionRepository.find({
        where: {
          stateUt: userStateUt,
          status: SubmissionStatus.RETURNED_FROM_MOSPI,
          currentOwnerRole: UserRole.STATE_APPROVER,
        },
        relations: ["user"],
        order: { updatedAt: "DESC" },
      });

      this.logger.log(
        `🔍 Found ${stateApproverSubmissions.length} STATE_APPROVER submission(s) with RETURNED_FROM_MOSPI status`
      );

      // Find the submission that contains this specific indicator
      let targetStateApproverSubmission = null;
      for (const sub of stateApproverSubmissions) {
        const formData = sub.formData || {};
        const categoryData = formData[category];
        if (categoryData && categoryData[section]) {
          const sectionData = categoryData[section];
          // Check if this section has the matching nodalOfficerId
          const sectionNodalId = Array.isArray(sectionData)
            ? sectionData[0]?.nodalOfficerId
            : sectionData?.nodalOfficerId;

          if (sectionNodalId === userId) {
            targetStateApproverSubmission = sub;
            break;
          }
        }
      }

      if (targetStateApproverSubmission) {
        this.logger.log(
          `✅ Found STATE_APPROVER submission ${targetStateApproverSubmission.id} (${targetStateApproverSubmission.submissionId}) for indicator ${section}`
        );

        // Update the STATE_APPROVER's submission with RESUBMITTED status
        const stateApproverFormData: any =
          targetStateApproverSubmission.formData
            ? JSON.parse(JSON.stringify(targetStateApproverSubmission.formData))
            : {};

        // Ensure category and section exist
        if (
          !stateApproverFormData[category] ||
          typeof stateApproverFormData[category] !== "object"
        ) {
          stateApproverFormData[category] = {};
        }
        if (
          !stateApproverFormData[category][section] ||
          typeof stateApproverFormData[category][section] !== "object"
        ) {
          stateApproverFormData[category][section] = {};
        }

        const targetStateApproverSection =
          stateApproverFormData[category][section];

        // Copy the updated data from NODAL_OFFICER's submission
        const updatedSectionData = newFormData[category]?.[section];
        if (updatedSectionData) {
          // Merge the updated data while ensuring status is RESUBMITTED
          Object.assign(targetStateApproverSection, updatedSectionData);
          targetStateApproverSection.status = "RESUBMITTED"; // Ensure status is RESUBMITTED
        } else {
          // If no updated data, just update the status
          targetStateApproverSection.status = "RESUBMITTED";
        }

        this.logger.log(
          `📝 Syncing indicator ${section} to RESUBMITTED in STATE_APPROVER submission`
        );

        // Update the STATE_APPROVER's submission
        await this.submissionRepository.update(
          targetStateApproverSubmission.id,
          {
            formData: stateApproverFormData,
            updatedAt: new Date(),
          }
        );

        this.logger.log(
          `✅ Synced STATE_APPROVER submission ${targetStateApproverSubmission.id} (${targetStateApproverSubmission.submissionId}) - indicator ${section} set to RESUBMITTED`
        );
      } else {
        this.logger.warn(
          `⚠️ Could not find STATE_APPROVER submission for indicator ${section} with status RETURNED_FROM_MOSPI. Searched ${stateApproverSubmissions.length} submission(s).`
        );
      }
    }

    // sectionStatus removed: no progress tracking or redirect info

    // Add indicator score to response if calculated
    if (calculatedScore) {
      (refreshed as any).indicatorScore = {
        indicatorCode: calculatedScore.indicatorCode,
        score: parseFloat(calculatedScore.score.toString()),
        maxScore: parseFloat(calculatedScore.maxScore.toString()),
        category: calculatedScore.category,
        calculation: calculatedScore.calculation,
        updatedAt: calculatedScore.updatedAt,
      };
    }

    return refreshed;
  }

  /**
   * TESTING ONLY: Cleanup method to delete test data
   * Deletes:
   * 1. Submissions made by NODAL_OFFICER, STATE_APPROVER, and MOSPI_REVIEWER
   * 2. FinalScore records related to those submissions
   * 3. UserIndicatorScope records for NODAL_OFFICER users
   *
   * WARNING: This is a destructive operation for testing purposes only!
   */
  async cleanupTestData(): Promise<{
    success: boolean;
    message: string;
    deleted: {
      submissions: number;
      finalScores: number;
      userIndicatorScopes: number;
      auditLogs: number;
    };
  }> {
    this.logger.warn("=== TEST DATA CLEANUP STARTED ===");
    this.logger.warn(
      "WARNING: This will delete test submissions and indicator assignments!"
    );

    return this.dataSource.transaction(async (manager) => {
      // Step 1: Find all users with the specified roles
      const targetRoles = [
        UserRole.NODAL_OFFICER,
        UserRole.STATE_APPROVER,
        UserRole.MOSPI_REVIEWER,
      ];

      const users = await manager.find(User, {
        where: { role: In(targetRoles) },
        select: ["id", "role", "email"],
      });

      const userIds = users.map((u) => u.id);
      const nodalOfficerIds = users
        .filter((u) => u.role === UserRole.NODAL_OFFICER)
        .map((u) => u.id);

      this.logger.log(
        `Found ${users.length} users with roles: ${targetRoles.join(", ")}`
      );
      this.logger.log(`Found ${nodalOfficerIds.length} NODAL_OFFICER users`);

      // Step 2: Find all submissions by these users
      const submissions = await manager.find(Submission, {
        where: { submittedBy: In(userIds) },
        select: ["id", "submissionId", "submittedBy", "attachedFiles"],
      });

      const submissionIds = submissions.map((s) => s.id);

      this.logger.log(`Found ${submissions.length} submissions to delete`);

      // Step 3: Delete FinalScore records related to these submissions
      // This must be done BEFORE deleting submissions due to foreign key constraint (NO ACTION)
      let deletedFinalScores = 0;
      if (submissionIds.length > 0) {
        const finalScores = await manager.find(FinalScore, {
          where: { submissionId: In(submissionIds) },
        });
        deletedFinalScores = finalScores.length;
        if (finalScores.length > 0) {
          await manager.remove(FinalScore, finalScores);
          this.logger.log(`Deleted ${finalScores.length} FinalScore records`);
        }
      }

      // Step 4: Delete submissions
      let deletedSubmissions = 0;
      if (submissions.length > 0) {
        // Also delete attached files if any
        for (const submission of submissions) {
          if (
            submission.attachedFiles &&
            Array.isArray(submission.attachedFiles) &&
            submission.attachedFiles.length > 0
          ) {
            try {
              // Extract file paths from attachedFiles
              const filePaths = submission.attachedFiles
                .map((file: any) => file.filePath || file.path)
                .filter((path: string) => path); // Filter out null/undefined paths

              if (filePaths.length > 0) {
                await this.storageService.deleteSubmissionFiles(
                  submission.submissionId,
                  filePaths
                );
              }
            } catch (error) {
              this.logger.warn(
                `Failed to delete files for submission ${submission.id}: ${error.message}`
              );
            }
          }
        }
        await manager.remove(Submission, submissions);
        deletedSubmissions = submissions.length;
        this.logger.log(`Deleted ${submissions.length} submissions`);
      }

      // Step 5: Delete UserIndicatorScope records for NODAL_OFFICER users
      let deletedScopes = 0;
      if (nodalOfficerIds.length > 0) {
        const userIndicatorScopes = await manager.find(UserIndicatorScope, {
          where: { userId: In(nodalOfficerIds) },
        });
        deletedScopes = userIndicatorScopes.length;
        if (userIndicatorScopes.length > 0) {
          await manager.remove(UserIndicatorScope, userIndicatorScopes);
          this.logger.log(
            `Deleted ${userIndicatorScopes.length} UserIndicatorScope records`
          );
        }
      }

      // Step 6: Delete AuditLog records for these users and their submissions
      let deletedAuditLogs = 0;
      if (userIds.length > 0 || submissionIds.length > 0) {
        // Delete audit logs for users
        const userAuditLogs = await manager.find(AuditLog, {
          where: { userId: In(userIds.map((id) => id.toString())) },
        });

        // Delete audit logs for submissions (if any)
        const submissionAuditLogs = await manager.find(AuditLog, {
          where: {
            entityType: "Submission",
            entityId: In(submissionIds.map((id) => id.toString())),
          },
        });

        const allAuditLogs = [...userAuditLogs, ...submissionAuditLogs];
        deletedAuditLogs = allAuditLogs.length;

        if (allAuditLogs.length > 0) {
          // Remove duplicates based on id
          const uniqueAuditLogs = Array.from(
            new Map(allAuditLogs.map((log) => [log.id, log])).values()
          );
          await manager.remove(AuditLog, uniqueAuditLogs);
          this.logger.log(`Deleted ${uniqueAuditLogs.length} AuditLog records`);
        }
      }

      this.logger.warn("=== TEST DATA CLEANUP COMPLETED ===");

      return {
        success: true,
        message: "Test data cleanup completed successfully",
        deleted: {
          submissions: deletedSubmissions,
          finalScores: deletedFinalScores,
          userIndicatorScopes: deletedScopes,
          auditLogs: deletedAuditLogs,
        },
      };
    });
  }
  // ...existing code...

  // ...existing code...
  /**
   * Revert submissions from RETURNED_FROM_MOSPI to SUBMITTED_TO_MOSPI_REVIEWER
   * for a specific user
   */
  async revertFromMospiToReviewer(
    userId: string,
    requestingUserId: string,
    requestingUserRole: UserRole
  ): Promise<{ message: string; updatedCount: number; submissions: any[] }> {
    this.logger.log(
      `Reverting RETURNED_FROM_MOSPI submissions for userId=${userId} by ${requestingUserId}`
    );

    try {
      // Find all submissions by this user with status RETURNED_FROM_MOSPI
      const submissions = await this.submissionRepository.find({
        where: {
          submittedBy: userId,
          status: SubmissionStatus.RETURNED_FROM_MOSPI,
        },
        relations: ["user", "finalScore"],
      });

      if (submissions.length === 0) {
        return {
          message: `No submissions found with status RETURNED_FROM_MOSPI for user ${userId}`,
          updatedCount: 0,
          submissions: [],
        };
      }

      // Update each submission
      const updatedSubmissions = [];
      for (const submission of submissions) {
        await this.submissionRepository.update(submission.id, {
          status: SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
          currentOwnerRole: UserRole.MOSPI_REVIEWER,
          updatedAt: new Date(),
        });

        updatedSubmissions.push({
          submissionId: submission.submissionId,
          id: submission.id,
          previousStatus: SubmissionStatus.RETURNED_FROM_MOSPI,
          newStatus: SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
          newOwner: UserRole.MOSPI_REVIEWER,
        });

        this.logger.log(
          `Updated submission ${submission.submissionId} from RETURNED_FROM_MOSPI to SUBMITTED_TO_MOSPI_REVIEWER`
        );
      }

      return {
        message: `Successfully reverted ${submissions.length} submission(s) to MOSPI Reviewer`,
        updatedCount: submissions.length,
        submissions: updatedSubmissions,
      };
    } catch (error) {
      this.logger.error(
        `Error reverting submissions for user ${userId}: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }
  /**
   * Clean mospi_status from all categories in formData
   * Recursively removes mospi_status ONLY when value is "REVERTED"
   * Preserves mospi_status when value is "ACCEPTED"
   * Applies to:
   * - infraFinancing
   * - infraDevelopment (including nested arrays like infraActArray, specializedEntityArray)
   * - pppDevelopment (including nested arrays)
   * - infraEnablers (including nested arrays)
   */
  async cleanMospiStatusFromSubmission(
    id: string,
    userId: string,
    userRole: UserRole,
    userStateUt: string
  ): Promise<Submission> {
    try {
      this.logger.log(`=== CLEAN MOSPI STATUS START ===`);
      this.logger.log(
        `ID: ${id}, UserId: ${userId}, UserRole: ${userRole}, StateUt: ${userStateUt}`
      );

      // Step 1: Find submission
      const submission = await this.findOne(id, userRole, userStateUt);
      this.logger.log(`Found submission with status: ${submission.status}`);

      // Step 2: Deep clone formData to avoid mutating the entity
      const formData = submission.formData
        ? JSON.parse(JSON.stringify(submission.formData))
        : {};

      this.logger.log(
        `Starting cleanup of mospi_status (REVERTED only) from formData. Categories: ${Object.keys(formData).join(", ")}`
      );

      // Step 3: Recursively remove mospi_status from all categories (only when REVERTED)
      const categories = [
        "infraFinancing",
        "infraDevelopment",
        "pppDevelopment",
        "infraEnablers",
      ];

      let totalRemoved = 0;
      let totalPreserved = 0;

      // Helper function to recursively remove mospi_status ONLY when value is "REVERTED"
      const removeMospiStatus = (obj: any, path: string = ""): number => {
        if (!obj || typeof obj !== "object") {
          return 0;
        }

        let removed = 0;

        // If it's an array, process each item
        if (Array.isArray(obj)) {
          obj.forEach((item, index) => {
            if (item && typeof item === "object") {
              // Check if mospi_status exists and only remove if value is "REVERTED"
              if ("mospi_status" in item) {
                if (item.mospi_status === "REVERTED") {
                  delete item.mospi_status;
                  removed++;
                  this.logger.log(
                    `🗑️ Removed mospi_status (REVERTED) from ${path}[${index}]`
                  );
                } else if (item.mospi_status === "ACCEPTED") {
                  totalPreserved++;
                  this.logger.log(
                    `✅ Preserved mospi_status (ACCEPTED) from ${path}[${index}]`
                  );
                }
              }
              // Recursively process nested objects in array items
              removed += removeMospiStatus(item, `${path}[${index}]`);
            }
          });
        } else {
          // If it's an object, remove mospi_status ONLY if value is "REVERTED"
          if ("mospi_status" in obj) {
            if (obj.mospi_status === "REVERTED") {
              delete obj.mospi_status;
              removed++;
              this.logger.log(
                `🗑️ Removed mospi_status (REVERTED) from ${path || "root"}`
              );
            } else if (obj.mospi_status === "ACCEPTED") {
              totalPreserved++;
              this.logger.log(
                `✅ Preserved mospi_status (ACCEPTED) from ${path || "root"}`
              );
            }
          }

          // Recursively process all properties
          for (const key in obj) {
            if (obj[key] && typeof obj[key] === "object") {
              removed += removeMospiStatus(
                obj[key],
                path ? `${path}.${key}` : key
              );
            }
          }
        }

        return removed;
      };

      // Process each category
      for (const category of categories) {
        if (formData[category] && typeof formData[category] === "object") {
          this.logger.log(
            `🔍 Processing category: ${category} with ${Object.keys(formData[category]).length} sections`
          );

          const categoryRemoved = removeMospiStatus(
            formData[category],
            category
          );
          totalRemoved += categoryRemoved;

          this.logger.log(
            `✅ Category ${category}: Removed ${categoryRemoved} mospi_status field(s) with REVERTED status`
          );
        } else {
          this.logger.log(`⚠️ Category ${category}: Not found or invalid type`);
        }
      }

      this.logger.log(
        `✅ Cleanup completed. Total removed: ${totalRemoved} mospi_status field(s) with REVERTED status. Total preserved: ${totalPreserved} mospi_status field(s) with ACCEPTED status`
      );

      // Step 4: Update submission with cleaned formData
      await this.submissionRepository.update(id, {
        formData: formData,
        updatedAt: new Date(),
      });

      this.logger.log(`Submission updated successfully with cleaned formData`);

      // Step 5: Return updated submission
      const updatedSubmission = await this.findOne(id, userRole, userStateUt);
      this.logger.log(`=== CLEAN MOSPI STATUS SUCCESS ===`);

      return updatedSubmission;
    } catch (error) {
      this.logger.error(`=== CLEAN MOSPI STATUS ERROR ===`);
      this.logger.error(
        `Error cleaning mospi_status from submission ${id}: ${error.message}`
      );
      this.logger.error(`Stack trace: ${error.stack}`);
      throw error;
    }
  }
}
