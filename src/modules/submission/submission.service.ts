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
import { Repository, DataSource, In } from "typeorm";
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
import { AuditLog } from "../../entities/audit-log.entity";
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
      select: ['id', 'stateUt'],
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
        .split(',')
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
      // .andWhere("scope.isActive = :isActive", { isActive: true })
      .andWhere("indicator.isActive = :indicatorActive", {
        indicatorActive: true,
      })
      .getMany();

    return userIndicatorScopes.map((scope) => scope.indicator.code);
  }

  // Helper function to extract indicator code from file path
  // File paths typically follow: submissions/{submissionId}/{category}/{sectionKey}/...
  private extractIndicatorFromFilePath(filePath: string): string | null {
    if (!filePath || typeof filePath !== "string") return null;

    // Map section keys to indicator codes
    const sectionToIndicatorMap: Record<string, string> = {
      section1_1: "1.1",
      section1_2: "1.2",
      section1_3: "1.3",
      section1_4: "1.4",
      section1_5: "1.5",
      section2_1: "2.1",
      section2_2: "2.2",
      section2_3: "2.3",
      section2_4: "2.4",
      section2_5: "2.5",
      section3_1: "3.1",
      section3_2: "3.2",
      section3_3: "3.3",
      section3_4: "3.4",
      section4_1: "4.1",
      section4_2: "4.2",
      section4_3: "4.3",
      section4_4: "4.4",
      section4_5: "4.5",
      section4_6: "4.6",
    };

    // Try to extract section key from path
    const pathParts = filePath.split("/");
    for (const part of pathParts) {
      if (part.startsWith("section") && sectionToIndicatorMap[part]) {
        return sectionToIndicatorMap[part];
      }
    }

    return null;
  }

  // Helper function to find indicator for a file by searching formData
  private findIndicatorForFileInFormData(
    filePath: string | undefined,
    formData: any
  ): string | null {
    if (!filePath || !formData) return null;

    // First try extracting from filePath
    const indicatorFromPath = this.extractIndicatorFromFilePath(filePath);
    if (indicatorFromPath) return indicatorFromPath;

    // Then search formData recursively
    const searchInObject = (obj: any, currentPath: string = ""): string | null => {
      if (!obj || typeof obj !== "object") return null;

      // Check if this object has filePath matching our file
      if (obj.filePath === filePath) {
        // Extract indicator from current path
        const pathParts = currentPath.split(".");
        for (const part of pathParts) {
          if (part.startsWith("section")) {
            const sectionToIndicatorMap: Record<string, string> = {
              section1_1: "1.1", section1_2: "1.2", section1_3: "1.3",
              section1_4: "1.4", section1_5: "1.5",
              section2_1: "2.1", section2_2: "2.2", section2_3: "2.3",
              section2_4: "2.4", section2_5: "2.5",
              section3_1: "3.1", section3_2: "3.2", section3_3: "3.3",
              section3_4: "3.4",
              section4_1: "4.1", section4_2: "4.2", section4_3: "4.3",
              section4_4: "4.4", section4_5: "4.5", section4_6: "4.6",
            };
            if (sectionToIndicatorMap[part]) {
              return sectionToIndicatorMap[part];
            }
          }
        }
      }

      // Check nested file structures
      if (obj.file?.filePath === filePath || obj.file?.file?.filePath === filePath) {
        const pathParts = currentPath.split(".");
        for (const part of pathParts) {
          if (part.startsWith("section")) {
            const sectionToIndicatorMap: Record<string, string> = {
              section1_1: "1.1", section1_2: "1.2", section1_3: "1.3",
              section1_4: "1.4", section1_5: "1.5",
              section2_1: "2.1", section2_2: "2.2", section2_3: "2.3",
              section2_4: "2.4", section2_5: "2.5",
              section3_1: "3.1", section3_2: "3.2", section3_3: "3.3",
              section3_4: "3.4",
              section4_1: "4.1", section4_2: "4.2", section4_3: "4.3",
              section4_4: "4.4", section4_5: "4.5", section4_6: "4.6",
            };
            if (sectionToIndicatorMap[part]) {
              return sectionToIndicatorMap[part];
            }
          }
        }
      }

      // Recurse into arrays
      if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          const result = searchInObject(obj[i], `${currentPath}[${i}]`);
          if (result) return result;
        }
        return null;
      }

      // Recurse into objects
      for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith("_")) continue; // Skip metadata
        const newPath = currentPath ? `${currentPath}.${key}` : key;
        const result = searchInObject(value, newPath);
        if (result) return result;
      }

      return null;
    };

    return searchInObject(formData);
  }

  // Helper function to filter attachedFiles based on indicator access
  private async filterAttachedFilesByIndicatorAccess(
    attachedFiles: any[],
    formData: any,
    userId: string,
    userRole: UserRole
  ): Promise<any[]> {
    // MOSPI roles see all files
    if (userRole === UserRole.MOSPI_REVIEWER || userRole === UserRole.MOSPI_APPROVER) {
      return attachedFiles || [];
    }

    // If no attachedFiles, return empty array
    if (!attachedFiles || !Array.isArray(attachedFiles) || attachedFiles.length === 0) {
      return [];
    }

    // For NODAL_OFFICER, filter by assigned indicators
    if (userRole === UserRole.NODAL_OFFICER) {
      const assignedIndicatorCodes = await this.getUserIndicatorCodes(userId);
      
      if (assignedIndicatorCodes.length === 0) {
        this.logger.log(`User ${userId} has no assigned indicators, returning empty attachedFiles`);
        return [];
      }

      this.logger.log(
        `Filtering attachedFiles for NODAL_OFFICER ${userId} with indicators: ${assignedIndicatorCodes.join(", ")}`
      );

      const filtered = attachedFiles.filter((file) => {
        const filePath = file?.filePath || file?.filepath;
        const indicator = this.findIndicatorForFileInFormData(filePath, formData);
        
        if (!indicator) {
          // If we can't determine the indicator, hide it for safety
          this.logger.warn(`Could not determine indicator for file: ${filePath}`);
          return false;
        }

        const hasAccess = assignedIndicatorCodes.includes(indicator);
        if (!hasAccess) {
          this.logger.log(`Filtering out file ${filePath} (indicator ${indicator} not assigned)`);
        }
        return hasAccess;
      });

      this.logger.log(
        `Filtered attachedFiles: ${attachedFiles.length} -> ${filtered.length} files`
      );

      return filtered;
    }

    // For STATE_APPROVER, they see all files in their state (no filtering needed)
    // This is handled by state-level access control
    return attachedFiles;
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
        if (node.filePath && (typeof node.filePath === 'string') && !node.fileName) {
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

  // Deep merge helper to preserve existing nested section data while updating changed fields
  private deepMergeFormData(existing: any, incoming: any): any {
    // If either is an array, replace entirely (arrays treated as atomic lists)
    if (Array.isArray(existing) || Array.isArray(incoming)) {
      return incoming !== undefined ? incoming : existing;
    }
    // Merge plain objects
    if (existing && typeof existing === 'object' && incoming && typeof incoming === 'object') {
      const result: any = { ...existing };
      for (const [key, value] of Object.entries(incoming)) {
        if (value === undefined) {
          // Skip undefined so we keep old value
          continue;
        }
        result[key] = this.deepMergeFormData(existing[key], value);
      }
      return result;
    }
    // Primitive / null / function / other types: incoming wins if defined, else keep existing
    return incoming !== undefined ? incoming : existing;
  }

  async uploadFile(
    file: Express.Multer.File,
    context: { submissionId: string; path: string }
  ) {
    const uploadPath = `${context.submissionId}/${context.path}`;
    const stored = await this.storageService.uploadFile(file, uploadPath);
    return stored; // should contain { url, key, bucket } if your service is consistent
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

      // Step 2: Check if user already has a submission (instead of checking submissionId)
      this.logger.log(
        `Checking for existing submission for user: ${userId}`
      );
      const existingUserSubmission = await this.submissionRepository.findOne({
        where: { submittedBy: userId },
        relations: ["user"],
      });

      // If user already has a submission, update it instead of creating new
      if (existingUserSubmission) {
        this.logger.log(
          `User ${userId} already has submission ${existingUserSubmission.id}. Updating instead of creating new.`
        );
        
        // Deep merge new formData with existing formData to preserve all nested section data
        const mergedFormData = this.deepMergeFormData(
          existingUserSubmission.formData || {},
          createSubmissionDto.formData || {}
        );
        
        this.logger.log(
          `Deep merging formData - Existing keys: ${Object.keys(existingUserSubmission.formData || {}).length}, New keys: ${Object.keys(createSubmissionDto.formData || {}).length}, Merged keys: ${Object.keys(mergedFormData).length}`
        );
        
        await this.submissionRepository.update(existingUserSubmission.id, {
          formData: mergedFormData,
          updatedAt: new Date(),
        });

        const updatedSubmission = await this.submissionRepository.findOne({
          where: { id: existingUserSubmission.id },
          relations: ["user", "finalScore"],
        });

        this.logger.log(`Submission updated successfully: ${updatedSubmission.id}`);
        this.logger.log(`=== CREATE SUBMISSION (UPDATE) SUCCESS ===`);

        return {
          status: true,
          data: updatedSubmission,
          message: "Submission updated successfully",
          timestamp: new Date().toISOString(),
        };
      }

      // Step 3: Determine status and owner role based on input
      const status = createSubmissionDto.status || SubmissionStatus.DRAFT;
      const currentOwnerRole = this.getOwnerRoleFromStatus(status);

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

      this.logger.log(`=== PROCESSING ATTACHED FILES ===`);
      this.logger.log(
        `attachedFiles in DTO: ${Array.isArray((createSubmissionDto as any).attachedFiles) ? (createSubmissionDto as any).attachedFiles.length : 'not an array or missing'}`
      );

      if (
        Array.isArray((createSubmissionDto as any).attachedFiles) &&
        (createSubmissionDto as any).attachedFiles.length
      ) {
        // Track unique file paths to prevent duplicates
        const seenFilePaths = new Set<string>();
        
        this.logger.log(
          `Processing ${(createSubmissionDto as any).attachedFiles.length} files from attachedFiles array`
        );
        
        newAttachedFiles = (createSubmissionDto as any).attachedFiles
          .map((f: any) => {
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
          })
          .filter((file: SubmissionFile) => {
            // Filter out duplicates based on filePath
            if (file.filePath && file.filePath.trim() !== "") {
              if (seenFilePaths.has(file.filePath)) {
                this.logger.warn(
                  `Duplicate file detected in attachedFiles, skipping: ${file.filePath}`
                );
                return false;
              }
              seenFilePaths.add(file.filePath);
              return true;
            }
            // If no filePath, include it (shouldn't happen, but handle gracefully)
            return true;
          });
        
        this.logger.log(
          `After deduplication: ${newAttachedFiles.length} unique files`
        );
        this.logger.log(
          `Sample files: ${newAttachedFiles.slice(0, 3).map(f => f.filePath).join(', ')}`
        );
      } else {
        this.logger.warn(
          `No attachedFiles in DTO or empty array. attachedFiles will be empty in submission.`
        );
      }

      const submission = this.submissionRepository.create({
        submissionId: createSubmissionDto.submissionId,
        formData: processedFormData,
        submittedBy: userId,
        stateUt,
        status: status,
        currentOwnerRole: currentOwnerRole,
        attachedFiles: newAttachedFiles,
      });
      
      this.logger.log(
        `Submission created with ${newAttachedFiles.length} files in attachedFiles`
      );

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
        ? userStateUt.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
      
      this.logger.log(
        `[MOSPI_REVIEWER] UserId: ${userId}, UserStateUt: ${userStateUt}, AssignedStates: ${JSON.stringify(assignedStates)}`
      );
      
      if (assignedStates.length > 0) {
        // Use IN clause for multiple states, or exact match for single state
        // Use case-insensitive comparison to handle state name variations
        if (assignedStates.length === 1) {
          query.andWhere("LOWER(TRIM(submission.stateUt)) = LOWER(TRIM(:stateUt))", { 
            stateUt: assignedStates[0] 
          });
        } else {
          // For multiple states, use case-insensitive IN comparison
          const lowerAssignedStates = assignedStates.map(s => s.toLowerCase());
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

      // Step 5: Filter attachedFiles based on indicator access
      // This ensures files are only visible to users who have access to the indicators they belong to
      if (submission.attachedFiles && Array.isArray(submission.attachedFiles)) {
        this.logger.log(`=== FILTERING ATTACHED FILES BY INDICATOR ACCESS ===`);
        this.logger.log(
          `Original attachedFiles count: ${submission.attachedFiles.length}`
        );
        
        // Get the requesting user's ID (for NODAL_OFFICER filtering)
        // Note: For NODAL_OFFICER, we use submission.submittedBy if they're viewing their own submission
        // For other cases, we'd need the actual requesting user ID, but for now we'll use submittedBy
        // This should be improved to pass the actual requesting user ID
        const requestingUserId = submission.submittedBy; // TODO: Get actual requesting user ID
        
        submission.attachedFiles = await this.filterAttachedFilesByIndicatorAccess(
          submission.attachedFiles,
          submission.formData,
          requestingUserId,
          userRole
        );
        
        this.logger.log(
          `Filtered attachedFiles count: ${submission.attachedFiles.length}`
        );
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
  async findByUser(userId: string, role: UserRole, stateUt: string) {
    return this.submissionRepository.findOne({
      where: { submittedBy: userId },
      relations: ["user", "finalScore"],
      order: { createdAt: "DESC" },
    });
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

      // Step 4: Update submission with section status
      this.logger.log(
        `Updating submission with data: ${JSON.stringify(updateSubmissionDto)}`
      );
      
      // Deep merge formData if being updated to preserve all nested section data
      let updateData: any = { ...updateSubmissionDto };
      if (updateSubmissionDto.formData) {
        // Deep merge new formData with existing formData
        const mergedFormData = this.deepMergeFormData(
          submission.formData || {},
          updateSubmissionDto.formData || {}
        );
        
        this.logger.log(
          `Deep merging formData - Existing keys: ${Object.keys(submission.formData || {}).length}, New keys: ${Object.keys(updateSubmissionDto.formData || {}).length}, Merged keys: ${Object.keys(mergedFormData).length}`
        );
        
        updateData.formData = mergedFormData;
      }
      
      await this.submissionRepository.update(id, updateData);

      // Step 6: Return updated submission
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

      // sectionStatus removed: skipping completion enforcement

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

      // sectionStatus removed: skipping completion enforcement

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
        const mergedFormData = this.deepMergeFormData(
          submission.formData || {},
          submitDto.formData || {}
        );
        await manager.update(Submission, id, {
          formData: mergedFormData,
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
      const hasReviewer = await this.hasMospiReviewerForState(submission.stateUt);
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
          formData: this.deepMergeFormData(
            submission.formData || {},
            resubmitDto.formData || {}
          ),
          // sectionStatus removed
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

      // Step 9: Refresh submission entity to ensure we have the latest status
      // This is important because we updated via raw SQL and need to ensure the entity is in sync
      const refreshedSubmission = await this.submissionRepository.findOne({
        where: { id },
      });
      
      if (refreshedSubmission) {
        this.logger.log(`Refreshed submission status: ${refreshedSubmission.status}`);
      }

      // Step 10: Calculate and store final score (after status is updated and entity is refreshed)
      // We know the status is APPROVED since we just set it, so we can skip the status check
      // Score calculation is MANDATORY - if it fails, we should retry before giving up
      this.logger.log(`=== STARTING SCORE CALCULATION FOR SUBMISSION: ${id} ===`);
      
      let finalScore: any = null;
      let scoringAttempts = 0;
      const maxScoringAttempts = 3;
      let lastScoringError: Error | null = null;

      // First, verify submission has formData before attempting calculation
      const submissionForValidation = await this.submissionRepository.findOne({
        where: { id },
        select: ['id', 'status', 'stateUt', 'formData'],
      });
      
      if (!submissionForValidation) {
        this.logger.error(`❌ CRITICAL: Cannot find submission ${id} for score calculation`);
        throw new Error(`Submission ${id} not found for score calculation`);
      }

      this.logger.log(`Submission validation - Status: ${submissionForValidation.status}, State: ${submissionForValidation.stateUt}, Has formData: ${!!submissionForValidation.formData}`);
      
      if (!submissionForValidation.formData || typeof submissionForValidation.formData !== 'object') {
        this.logger.error(`❌ CRITICAL: Submission ${id} has no formData. Cannot calculate score.`);
        throw new Error(`Submission ${id} has no form data. Cannot calculate score.`);
      }

      // Check formData structure
      const formDataKeys = Object.keys(submissionForValidation.formData);
      this.logger.log(`FormData keys found: ${formDataKeys.join(', ')}`);

      while (scoringAttempts < maxScoringAttempts && !finalScore) {
        scoringAttempts++;
        try {
          this.logger.log(`🔄 Attempting to calculate score for submission: ${id} (Attempt ${scoringAttempts}/${maxScoringAttempts})`);
          
          // Add a small delay before retrying if this is not the first attempt
          if (scoringAttempts > 1) {
            this.logger.log(`⏳ Waiting 500ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, 500));
            // Refresh submission again before retry
            const refreshedSubmissionForRetry = await this.submissionRepository.findOne({
              where: { id },
            });
            if (refreshedSubmissionForRetry) {
              this.logger.log(`Refreshed submission status before retry: ${refreshedSubmissionForRetry.status}`);
            }
          }

          this.logger.log(`📊 Calling scoringService.calculateScore for submission: ${id}`);
          finalScore = await this.scoringService.calculateScore(id, userId, true);
          this.logger.log(
            `✅ Final score calculated successfully for submission: ${id}, Score: ${finalScore.totalScore}, Percentage: ${finalScore.percentage}%`
          );
          break; // Success, exit retry loop
        } catch (scoringError) {
          lastScoringError = scoringError;
          this.logger.error(
            `❌ Scoring attempt ${scoringAttempts} failed for submission ${id}: ${scoringError.message}`
          );
          this.logger.error(
            `❌ Scoring error stack: ${scoringError.stack}`
          );
          
          // Log submission details for debugging
          const submissionForDebug = await this.submissionRepository.findOne({
            where: { id },
            select: ['id', 'status', 'stateUt', 'formData'],
          });
          if (submissionForDebug) {
            this.logger.error(
              `Submission details - Status: ${submissionForDebug.status}, State: ${submissionForDebug.stateUt}, Has formData: ${!!submissionForDebug.formData}`
            );
            if (submissionForDebug.formData) {
              const formDataKeys = Object.keys(submissionForDebug.formData);
              this.logger.error(`FormData keys: ${formDataKeys.join(', ')}`);
            }
          }

          // If this is the last attempt, throw error to prevent silent failure
          if (scoringAttempts >= maxScoringAttempts) {
            this.logger.error(
              `❌ CRITICAL: All ${maxScoringAttempts} scoring attempts failed for submission ${id}.`
            );
            this.logger.error(
              `❌ Last error: ${lastScoringError?.message}`
            );
            // Throw error to make it visible - approval should not complete without score
            throw new Error(
              `Score calculation failed after ${maxScoringAttempts} attempts for submission ${id}. ` +
              `Last error: ${lastScoringError?.message}. ` +
              `Please check logs and calculate score manually using /scoring/calculate/${id}`
            );
          }
        }
      }

      // Verify score was saved to database
      if (finalScore) {
        // Wait a moment for database to sync
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const savedScore = await this.finalScoreRepository.findOne({
          where: { submissionId: id },
        });
        if (savedScore) {
          this.logger.log(`✅ Verified: Score saved to database for submission: ${id}, Total Score: ${savedScore.totalScore}, Percentage: ${savedScore.percentage}%`);
        } else {
          this.logger.error(`❌ CRITICAL: Score calculated but not found in database for submission: ${id}. This indicates a database save issue.`);
          // Try to save again
          try {
            const scoreToSave = this.finalScoreRepository.create({
              submissionId: id,
              stateUt: submissionForValidation.stateUt,
              totalScore: finalScore.totalScore,
              percentage: finalScore.percentage,
              scoreBreakdown: finalScore,
              categoryScores: finalScore.categoryScores,
              calculationMethodology: finalScore.methodology,
              approvedBy: userId,
            });
            await this.finalScoreRepository.save(scoreToSave);
            this.logger.log(`✅ Retry save successful for submission: ${id}`);
          } catch (retrySaveError) {
            this.logger.error(`❌ Retry save failed: ${retrySaveError.message}`);
            throw new Error(`Failed to save score to database: ${retrySaveError.message}`);
          }
        }
      } else {
        this.logger.error(`❌ CRITICAL: Score calculation failed after ${maxScoringAttempts} attempts for submission: ${id}.`);
        throw new Error(`Score calculation failed for submission ${id}. Check logs for details.`);
      }

      this.logger.log(`=== SCORE CALCULATION COMPLETED FOR SUBMISSION: ${id} ===`);

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
    // sectionStatus helpers removed

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

  // getSectionStatus removed

  // Simplified stub after removing sectionStatus logic
  async checkAllSectionsCompleted(
    id: string,
    userRole: UserRole,
    userStateUt: string
  ): Promise<{
    allCompleted: boolean;
    completedCount: number;
    totalCount: number;
    incompleteSections: string[];
    sectionDetails: any[];
  }> {
    return {
      allCompleted: true,
      completedCount: 0,
      totalCount: 0,
      incompleteSections: [],
      sectionDetails: [],
    };
  }
  /**
   * Bulk update formData categories (infraFinancing, infraDevelopment, pppDevelopment, infraEnablers)
   * Accepts an object whose top-level keys are the category names to merge.
   */
  async bulkUpdateFormData(
    submissionId: string,
    updates: any,
    userId: string,
    userRole: UserRole,
    userStateUt: string
  ): Promise<Submission> {
    this.logger.log(`Bulk formData update requested for submissionId=${submissionId}`);

    if (!submissionId || !updates || typeof updates !== 'object') {
      throw new BadRequestException('submissionId and updates object are required');
    }

    const submission = await this.submissionRepository.findOne({
      where: { id: submissionId },
      relations: ['user', 'finalScore'],
    });
    if (!submission) {
      throw new NotFoundException(`Submission not found: ${submissionId}`);
    }

    // Permission checks (mirror updateFormSectionFields logic)
    if (userRole === UserRole.NODAL_OFFICER) {
      if (submission.stateUt !== userStateUt) {
        throw new ForbiddenException('Access denied: submission not in your state');
      }
      if (submission.submittedBy !== userId) {
        throw new ForbiddenException('Nodal Officers can update only their own submissions');
      }
    } else if (userRole === UserRole.STATE_APPROVER) {
      if (submission.stateUt !== userStateUt) {
        throw new ForbiddenException('Access denied: submission not in your state');
      }
    }

    const immutableStatuses = [
      SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
      SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER,
      SubmissionStatus.APPROVED,
      SubmissionStatus.REJECTED_FINAL,
    ];
    if (immutableStatuses.includes(submission.status)) {
      throw new BadRequestException(`Cannot modify submission in status ${submission.status}`);
    }

    const categories = [
      'infraFinancing',
      'infraDevelopment',
      'pppDevelopment',
      'infraEnablers',
    ];

    const deepMerge = (target: any, source: any): any => {
      if (source === null) return null;
      if (typeof source !== 'object' || Array.isArray(source)) return source;
      const result = { ...(typeof target === 'object' && !Array.isArray(target) ? target : {}) };
      for (const key of Object.keys(source)) {
        const value = source[key];
        if (value === undefined) continue;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          result[key] = deepMerge(result[key], value);
        } else {
          result[key] = value;
        }
      }
      return result;
    };

    const newFormData = submission.formData
      ? JSON.parse(JSON.stringify(submission.formData))
      : {};

    for (const cat of categories) {
      if (updates[cat] !== undefined) {
        this.logger.log(`Merging category ${cat}`);
        newFormData[cat] = deepMerge(newFormData[cat], updates[cat]);
      }
    }

    await this.submissionRepository.update(submission.id, {
      formData: newFormData,
      updatedAt: new Date(),
    });

    this.logger.log(`Bulk updated formData for submissionId=${submissionId}`);
    const refreshed = await this.submissionRepository.findOne({
      where: { id: submissionId },
      relations: ['user', 'finalScore'],
    });
    if (!refreshed) {
      throw new NotFoundException(`Submission not found after update: ${submissionId}`);
    }
    return refreshed;
  }

  /**
   * Update only specific keys inside submission.formData[category][section]
   * fields: array where each item can be either
   *  - { field: "keyName", value: any }
   *  - { keyName: any }   (single-key object)
   */

  async updateFormSectionFields(
    submissionId: string,
    category: string,
    section: string,
    fields: any[],
    userId: string,
    userRole: UserRole,
    userStateUt: string,
    sourceSubmissionId?: string,
  ): Promise<Submission | { warning: string; submission: Submission }> {
    this.logger.log(
      `Updating form section for submissionId=${submissionId} category=${category} section=${section} by user ${userId}`
    );
    this.logger.log(`Fields to update: ${JSON.stringify(fields)}`);

    if (!submissionId || !category || !section || !Array.isArray(fields)) {
      throw new BadRequestException(
        "submissionId, category, section and fields[] are required"
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

     // Check if current user is the submitter
    // if (submission.submittedBy === userId) {
    //   this.logger.warn(
    //     `User ${userId} attempted to send back their own submission ${submissionId}`
    //   );
    //   return {
    //     warning: "You cannot send back your own submission. This action requires a different reviewer.",
    //     submission: submission,
    //   };
    // }

    // Restrict edits once MOSPI processing or final approval/rejection has progressed
    // However, allow MOSPI_REVIEWER to update indicators when status is SUBMITTED_TO_MOSPI_REVIEWER
    // And allow MOSPI_APPROVER to update indicators when status is SUBMITTED_TO_MOSPI_APPROVER
    const immutableStatuses = [
      SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
      SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER,
      SubmissionStatus.APPROVED,
      SubmissionStatus.REJECTED_FINAL,
    ];
    
    // Allow MOSPI roles to update indicators in their respective statuses
    const canUpdateInCurrentStatus = 
      (userRole === UserRole.MOSPI_REVIEWER && submission.status === SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER) ||
      (userRole === UserRole.MOSPI_APPROVER && submission.status === SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER);
    
    if (immutableStatuses.includes(submission.status) && !canUpdateInCurrentStatus) {
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

    // Apply each provided field update (only update explicit keys)
  // ...existing code...
    // Helper function for deep merging objects
    const deepMerge = (target: any, source: any): any => {
      if (!source || typeof source !== 'object') return source;
      if (!target || typeof target !== 'object') return source;
      if (Array.isArray(source)) return source; // Arrays are replaced, not merged
      
      const result = { ...target };
      for (const key in source) {
        if (source[key] === undefined) continue; // Skip undefined values
        if (source[key] === null) {
          result[key] = null;
        } else if (typeof source[key] === 'object' && !Array.isArray(source[key]) &&
                   typeof result[key] === 'object' && !Array.isArray(result[key])) {
          result[key] = deepMerge(result[key], source[key]);
        } else {
          result[key] = source[key];
        }
      }
      return result;
    };

    this.logger.log(`Before update - targetSection[${Object.keys(targetSection)[0]}]: ${JSON.stringify(targetSection)}`);

    // Apply each provided field update (only update explicit keys)
    for (const item of fields) {
      this.logger.log(`Processing field item: ${JSON.stringify(item)}`);
      
      // Skip null, undefined, or empty items
      if (!item || typeof item !== "object") {
        this.logger.warn(`Skipping invalid item: ${JSON.stringify(item)}`);
        continue;
      }
      
      const keys = Object.keys(item);
      if (keys.length === 0) {
        this.logger.warn(`Skipping empty object`);
        continue;
      }
      
      // Process the valid item
      for (const key of keys) {
        this.logger.log(`Processing key: ${key}, isArray: ${Array.isArray(item[key])}`);
        
        // Deep merge for arrays to preserve existing data
        if (Array.isArray(item[key]) && Array.isArray(targetSection[key])) {
          this.logger.log(`Merging array for key ${key}. Existing length: ${targetSection[key].length}, New length: ${item[key].length}`);
          
          // Deep merge array items - merge objects at same index
          const newArray = [...targetSection[key]];
          item[key].forEach((newItem: any, index: number) => {
            this.logger.log(`  Array index ${index}: newItem=${JSON.stringify(newItem)}, existing=${JSON.stringify(newArray[index])}`);
            
            if (index < newArray.length) {
              // Merge with existing item at this index
              if (typeof newItem === 'object' && newItem !== null && 
                  typeof newArray[index] === 'object' && newArray[index] !== null) {
                // Deep merge objects in array
                const merged = deepMerge(newArray[index], newItem);
                this.logger.log(`    Deep merged result: ${JSON.stringify(merged)}`);
                newArray[index] = merged;
              } else if (newItem !== undefined && newItem !== null) {
                // Replace primitive or if new item is defined
                newArray[index] = newItem;
              }
              // If newItem is null/undefined, keep existing value
            } else {
              // New index, add to array
              newArray[index] = newItem;
            }
          });
          targetSection[key] = newArray;
          this.logger.log(`  Final array for ${key}: ${JSON.stringify(newArray)}`);
        } else if (Array.isArray(item[key]) && !targetSection[key]) {
          // New array field
          this.logger.log(`Creating new array for key ${key}`);
          targetSection[key] = item[key];
        } else if (typeof item[key] === 'object' && item[key] !== null && 
                   typeof targetSection[key] === 'object' && targetSection[key] !== null &&
                   !Array.isArray(item[key])) {
          // Deep merge for objects
          this.logger.log(`Deep merging object for key ${key}`);
          targetSection[key] = deepMerge(targetSection[key], item[key]);
        } else {
          // For primitives or null values, direct assignment
          this.logger.log(`Direct assignment for key ${key}: ${JSON.stringify(item[key])}`);
          targetSection[key] = item[key];
        }
      }
    }
    

    // Check if mospi_status was "Reverted" before update and if status is being set to "ACCEPTED"
    // If so, update mospi_status to "RESUBMITTED"
    const hadRevertedMospiStatus = targetSection.mospi_status === "REVERTED" || targetSection.mospi_status === "Reverted";
    const isBeingAccepted = targetSection.status === "ACCEPTED";
    
    if (hadRevertedMospiStatus && isBeingAccepted) {
      this.logger.log(`Detected ACCEPTED status with previous REVERTED mospi_status, updating mospi_status to RESUBMITTED`);
      targetSection.mospi_status = "RESUBMITTED";
    }

      // If sourceSubmissionId is provided, update status to REVERTED in the source submission
    if (sourceSubmissionId) {
      this.logger.log(`Updating status to REVERTED in source submission: ${sourceSubmissionId}`);
      
      const sourceSubmission = await this.submissionRepository.findOne({
        where: { submissionId: sourceSubmissionId },
      });

      if (sourceSubmission) {
        const sourceFormData = sourceSubmission.formData
          ? JSON.parse(JSON.stringify(sourceSubmission.formData))
          : {};

        // Update status in the same category/section of source submission
        if (sourceFormData[category]?.[section]) {
          
          if (targetSection.status === "ACCEPTED") {
            sourceFormData[category][section].status = "ACCEPTED";
            this.logger.log(`Setting source submission status to ACCEPTED`);
          } else {
            // Otherwise, set to REVERTED
            sourceFormData[category][section].status = "REVERTED";
            this.logger.log(`Setting source submission status to REVERTED`);
          }
          
          sourceFormData[category][section].consolidatedSubmissionId = submission.id;

          await this.submissionRepository.update(sourceSubmission.id, {
            formData: sourceFormData,
            updatedAt: new Date(),
          });

          this.logger.log(
            `Updated status to REVERTED in source submission ${sourceSubmissionId} for category=${category} section=${section}`
          );
        } else {
          this.logger.warn(
            `Source submission ${sourceSubmissionId} does not have category=${category} section=${section}`
          );
        }
      } else {
        this.logger.warn(`Source submission not found: ${sourceSubmissionId}`);
      }
    }


     // Check if current section has consolidatedSubmissionId and update that submission's status to RESUBMITTED
    if (targetSection.consolidatedSubmissionId) {
      this.logger.log(`Found consolidatedSubmissionId: ${targetSection.consolidatedSubmissionId}`);
      
      const consolidatedSubmission = await this.submissionRepository.findOne({
        where: { id: targetSection.consolidatedSubmissionId },
      });

      if (consolidatedSubmission) {
        const consolidatedFormData = consolidatedSubmission.formData
          ? JSON.parse(JSON.stringify(consolidatedSubmission.formData))
          : {};

        // Update status in the same category/section of consolidated submission
        if (consolidatedFormData[category]?.[section]) {
          consolidatedFormData[category][section].status = "RESUBMITTED";
          
          await this.submissionRepository.update(consolidatedSubmission.id, {
            formData: consolidatedFormData,
            updatedAt: new Date(),
          });

          this.logger.log(
            `Updated status to RESUBMITTED in consolidated submission ${targetSection.consolidatedSubmissionId} for category=${category} section=${section}`
          );
        } else {
          this.logger.warn(
            `Consolidated submission ${targetSection.consolidatedSubmissionId} does not have category=${category} section=${section}`
          );
        }
      } else {
        this.logger.warn(`Consolidated submission not found: ${targetSection.consolidatedSubmissionId}`);
      }
    }


    this.logger.log(
      `After merge - targetSection: ${JSON.stringify(targetSection)}`
    );

    // Persist update using repository (by internal id)
    await this.submissionRepository.update(submission.id, {
      formData: newFormData,
      updatedAt: new Date(),
    });

    this.logger.log(
      `Updated formData category=${category} section=${section} for submissionId=${submissionId}`
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

    return refreshed;
  }

  // ---------------- CUMULATIVE PREVIEW (STATE) ----------------
async buildCumulativePreview(params: {
  stateUt: string;
  year?: string;
  userRole: UserRole;
  userStateUt?: string;
  debug?: string; // optional ?debug=1
}) {
  const { stateUt, year, userRole, userStateUt, debug } = params;
  const DEBUG = debug === '1';

  // ---------- Access control ----------
  if (
    userRole !== UserRole.ADMIN &&
    userRole !== UserRole.MOSPI_REVIEWER &&
    userRole !== UserRole.MOSPI_APPROVER &&
    userRole !== UserRole.STATE_APPROVER &&
    userRole !== UserRole.NODAL_OFFICER
  ) throw new ForbiddenException('Access denied');

  // Normalize state comparison (case-insensitive and trim whitespace)
  const normalizedStateUt = stateUt?.trim().toLowerCase();
  const normalizedUserStateUt = userStateUt?.trim().toLowerCase();

  if (userRole === UserRole.STATE_APPROVER && normalizedUserStateUt && normalizedUserStateUt !== normalizedStateUt) {
    this.logger.warn(`STATE_APPROVER access denied: userStateUt="${userStateUt}" !== stateUt="${stateUt}"`);
    throw new ForbiddenException('You can only preview your own state');
  }

  // ---------- Helpers ----------
  const categoryToParentKey = (category?: string) => {
    switch ((category || '').toLowerCase()) {
      case 'infrastructure financing':   return 'infraFinancing';
      case 'infrastructure development': return 'infraDevelopment';
      case 'ppp development':            return 'pppDevelopment';
      case 'infrastructure enablers':    return 'infraEnablers';
      default: return '';
    }
  };
  const codeToSectionKey = (code: string) => `section${String(code).replace('.', '_')}`;
  const deepGet = (obj: any, path: string): any =>
    path.split('.').reduce((a, k) => (a && typeof a === 'object' ? a[k] : undefined), obj);

  const normalizeYear = (y: any): string | null => {
    if (!y) return null;
    return String(y).trim(); // keep "2025-26" as-is
  };

  const pickSubmissionYear = (s: any): string | null => {
    if (s?.metadata?.fiscalYear) return normalizeYear(s.metadata.fiscalYear);
    if (s?.formData?.meta?.year)  return normalizeYear(s.formData.meta.year);
    if (typeof s?.fiscalYear === 'string') return normalizeYear(s.fiscalYear);
    if (typeof s?.year === 'string')       return normalizeYear(s.year);
    if (typeof s?.formData?.year === 'string') return normalizeYear(s.formData.year);
    return null;
  };

  const pickScalarRecord = (rec: any) => (Array.isArray(rec) ? (rec.length ? rec[0] : null) : rec);

  // Find the record for a specific indicator inside a submission
  const findIndicatorPayload = (submission: any, ind: Indicator) => {
    const statuses: any[] | undefined = submission?.statuses;
    const formData = submission?.formData;

    // A) statuses[] (preferred)
    if (Array.isArray(statuses) && statuses.length) {
      const sectionKey = codeToSectionKey(ind.code);        // e.g. "section1_1"
      const parentKey  = categoryToParentKey(ind.category); // e.g. "infraFinancing"
      const wantPath   = parentKey ? `${parentKey}.${sectionKey}`.toLowerCase() : null;

      if (wantPath) {
        const exact = statuses.find(s => typeof s?.path === 'string' && s.path.toLowerCase() === wantPath);
        if (exact) return exact;
      }
      const bySection = statuses.find(s => (s?.sectionKey || '').toLowerCase() === sectionKey.toLowerCase());
      if (bySection) return bySection;

      const loose = statuses.find(s => s?.indicatorCode === ind.code || s?.code === ind.code || s?.name === ind.name);
      if (loose) return loose;
    }

    // B) legacy formData fallbacks
    if (formData && typeof formData === 'object') {
      // Direct lookups by code/id/name
      if (formData[ind.code] != null) return formData[ind.code];
      if (formData[ind.id]   != null) return formData[ind.id];
      if (formData[ind.name] != null) return formData[ind.name];

      const sectionKey = codeToSectionKey(ind.code);
      const parents = [
        'infraFinancing','infraDevelopment','pppDevelopment','infraEnablers',
        'infrastructureFinancing','infrastructureDevelopment','infrastructureEnablers'
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
      if (rec && typeof rec === 'object') {
        // Check if record has a code or sectionKey to locate it in formData
        const sectionKey = rec.sectionKey || (rec.code ? codeToSectionKey(rec.code) : null);
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
      status = 'NOT_STARTED';
    }
    
    return {
      status: status as string,
      score: rec?.marksObtained ?? rec?.score ?? null,
      remarks: rec?.remarks ?? rec?.comment ?? null,
      year: normalizeYear(rec?.year ?? rec?.fiscalYear ?? pickSubmissionYear(submission)),
      updatedAt: rec?.updatedAt ?? submission?.updatedAt ?? null,
    };
  };

  // ---------- 1) Indicators ----------
  const indicators: Indicator[] = await this.indicatorRepository.find({
    where: { isActive: true } as any,
    order: { sectionId: 'ASC', code: 'ASC' as any },
  });

  // ---------- 2) Submissions for state ----------
  let allSubsRaw: Submission[] = [];
  try {
    // Try case-insensitive comparison for stateUt
    allSubsRaw = await this.submissionRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.statuses', 'statuses')
      .where('LOWER(s.stateUt) = LOWER(:stateUt)', { stateUt })
      .getMany();
  } catch (err) {
    this.logger.warn(`Failed to query with join, falling back: ${err}`);
    // Fallback: get all submissions and filter in-memory (case-insensitive)
    const allSubs = await this.submissionRepository.find({ loadRelationIds: false });
    allSubsRaw = allSubs.filter(s => s.stateUt && s.stateUt.toLowerCase() === stateUt.toLowerCase());
  }

  this.logger.log(`[buildCumulativePreview] Found ${allSubsRaw.length} submissions for stateUt=${stateUt}`);
  if (allSubsRaw.length > 0) {
    this.logger.log(`[buildCumulativePreview] Sample submission IDs: ${allSubsRaw.slice(0, 3).map(s => s.submissionId).join(', ')}`);
    // Log sample formData structure
    const sample = allSubsRaw[0];
    if (sample?.formData) {
      const formDataKeys = Object.keys(sample.formData);
      this.logger.log(`[buildCumulativePreview] Sample formData keys: ${formDataKeys.join(', ')}`);
      if (formDataKeys.length > 0) {
        const firstKey = formDataKeys[0];
        const firstCategory = sample.formData[firstKey];
        if (firstCategory && typeof firstCategory === 'object') {
          const sectionKeys = Object.keys(firstCategory).slice(0, 3);
          this.logger.log(`[buildCumulativePreview] Sample ${firstKey} sections: ${sectionKeys.join(', ')}`);
        }
      }
    }
  }

  // Year filter in-memory (entity likely has no "year" column)
  const subs = year
    ? allSubsRaw.filter(s => (pickSubmissionYear(s) ?? '') === String(year))
    : allSubsRaw;
  
  if (year && subs.length !== allSubsRaw.length) {
    this.logger.log(`[buildCumulativePreview] Filtered to ${subs.length} submissions for year=${year}`);
  }

  // ---------- 3) Choose best submission per indicator ----------
  const bestByIndicator = new Map<string, Submission | null>();
  const dbg: any = DEBUG ? { totals: { submissions: subs.length }, perIndicator: {} } : undefined;

  for (const ind of indicators) {
    const candidates = subs.filter(s => {
      const payload = findIndicatorPayload(s, ind);
      return payload != null;
    });

    // Debug logging for first few indicators
    if (ind.code === '1.1' || ind.code === '1.2' || ind.code === '2.1') {
      this.logger.log(`[buildCumulativePreview] Indicator ${ind.code}: found ${candidates.length} candidate submissions`);
      if (candidates.length > 0) {
        const sampleCandidate = candidates[0];
        const samplePayload = findIndicatorPayload(sampleCandidate, ind);
        this.logger.log(`[buildCumulativePreview] Indicator ${ind.code}: sample payload keys: ${samplePayload && typeof samplePayload === 'object' ? Object.keys(samplePayload).join(', ') : 'not an object'}`);
        if (samplePayload && typeof samplePayload === 'object') {
          this.logger.log(`[buildCumulativePreview] Indicator ${ind.code}: sample payload status: ${samplePayload.status || 'no status field'}`);
        }
      }
    }

    const accepted = candidates.find(s => {
      const rec = pickScalarRecord(findIndicatorPayload(s, ind));
      const st = String(rec?.status || (s as any)?.status || '').toUpperCase();
      return st === 'ACCEPTED' || st === 'APPROVED' || st === 'ACCEPTED_BY_STATE_APPROVER';
    });

    const best =
      accepted ??
      (candidates.length
        ? candidates.sort(
            (a, b) =>
              new Date((b as any).updatedAt || (b as any).createdAt || 0).getTime() -
              new Date((a as any).updatedAt || (a as any).createdAt || 0).getTime()
          )[0]
        : null);

    bestByIndicator.set(ind.id, best);

    if (DEBUG) (dbg.perIndicator[ind.code] = { candidates: candidates.length, pickedAccepted: !!accepted });
  }

  // ---------- 4) Build grouped response ----------
  type PreviewItem = {
    id: string; code: string; name: string; category?: string; sectionId?: string;
    maxScore?: number | string; data: any; status: string; score: number | null; remarks: string | null;
    updatedAt: string | Date | null; year: string | null;
  };

  const grouped: Record<string, PreviewItem[]> = {};

  for (const ind of indicators) {
    const best = bestByIndicator.get(ind.id) as any;
    const record = best ? findIndicatorPayload(best, ind) : null;
    const meta = pickIndicatorMeta(record, best);

    const category = ind.category || 'Uncategorized';
    if (!grouped[category]) grouped[category] = [];

    // Extract data from record - if record has a 'data' property, use that, otherwise use the record itself
    // But exclude status, score, remarks, etc. from the data field (those are in meta)
    let dataField = null;
    if (record) {
      const rec = pickScalarRecord(record);
      if (rec && typeof rec === 'object') {
        // If record has a 'data' property, use that
        if ('data' in rec && rec.data != null) {
          dataField = rec.data;
        } else {
          // Otherwise, use the record but exclude metadata fields
          const { status, score, marksObtained, remarks, comment, updatedAt, year, fiscalYear, ...dataOnly } = rec;
          // Only include if there's actual data (not just metadata)
          if (Object.keys(dataOnly).length > 0) {
            dataField = dataOnly;
          }
        }
      } else {
        dataField = rec;
      }
    }

    grouped[category].push({
      id: ind.id,
      code: ind.code,
      name: ind.name,
      category: ind.category,
      sectionId: ind.sectionId,
      maxScore: ind.maxScore,
      data: dataField,
      status: meta.status,
      score: meta.score,
      remarks: meta.remarks,
      updatedAt: meta.updatedAt,
      year: meta.year,
    });

    if (DEBUG) {
      Object.assign(dbg.perIndicator[ind.code], {
        foundPayload: !!record,
        status: meta.status,
        score: meta.score,
        year: meta.year,
      });
    }
  }

    // ---------- 5) Return ----------
    return {
      status: true,
      message: `Cumulative preview for ${stateUt}`,
      data: {
        stateUt,
        users: 0, // we’re not computing people anymore
        totalIndicators: indicators.length,
        categories: Object.keys(grouped),
        indicators: grouped,
        ...(DEBUG ? { debug: dbg } : {}),
      },
    };
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
// ...existing code...

}
