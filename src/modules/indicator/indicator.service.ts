import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, Between } from "typeorm";
import { Indicator } from "../../entities/indicator.entity";
import { UserIndicatorScope } from "../../entities/user-indicator-scope.entity";
import { User, UserRole } from "../../entities/user.entity";
import { SubmissionStatus } from "../../entities/submission.entity";
import { Submission } from "../../entities/submission.entity";

@Injectable()
export class IndicatorService {
  constructor(
    @InjectRepository(Indicator)
    private readonly indicatorRepository: Repository<Indicator>,
    @InjectRepository(UserIndicatorScope)
    private readonly userIndicatorScopeRepository: Repository<UserIndicatorScope>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>
  ) {}
  /**
   * Fetch indicator status from nested submission's formData
   * @param submissionId string
   * @param parentKey string
   * @param sectionKey string
   * @param field string
   */
  async getIndicatorStatusFromSubmission(
    submissionId: string,
    parentKey: string,
    sectionKey: string,
    field: string
  ): Promise<any> {
    const submission = await this.submissionRepository.findOne({
      where: { submissionId },
    });
    if (!submission) {
      throw new Error("Submission not found");
    }
    const formData = submission.formData || {};
    if (!formData[parentKey] || !formData[parentKey][sectionKey]) {
      throw new Error("Parent key or section key not found in form data");
    }
    if (!(field in formData[parentKey][sectionKey])) {
      throw new Error("Field not found in section data");
    }
    return {
      parentKey,
      sectionKey,
      field,
      value: formData[parentKey][sectionKey][field],
    };
  }

  async getIndicatorsByStatus(
    submissionId: string,
    status: string
  ): Promise<any> {
    const submission = await this.submissionRepository.findOne({
      where: { submissionId },
    });
    if (!submission) {
      throw new Error("Submission not found");
    }

    const formData = submission.formData || {};
    const result: any[] = [];

    const searchForStatus = (obj: any, path: string[] = []) => {
      for (const key in obj) {
        if (typeof obj[key] === "object" && obj[key] !== null) {
          searchForStatus(obj[key], [...path, key]);
        } else if (key === "status" && obj[key] === status) {
          const sectionData = {
            path: path.join("."),
            parentKey: path[0],
            sectionKey: path[1],
            status: obj[key],
            ...obj,
          };
          result.push(sectionData);
        }
      }
    };

    searchForStatus(formData);

    return {
      submissionId,
      indicators: result,
    };
  }

  async findAll(): Promise<Indicator[]> {
    return this.indicatorRepository.find({
      where: { isActive: true },
      order: { code: "ASC" },
    });
  }

  async findOne(id: string): Promise<Indicator> {
    return this.indicatorRepository.findOne({
      where: { id },
    });
  }

  async getIndicatorsByState(stateUt: string): Promise<any> {
    try {
      // First, find users from the specified state
      const stateUsers = await this.userRepository.find({
        where: { stateUt },
      });

      if (!stateUsers || stateUsers.length === 0) {
        return {
          message: `No users found for state: ${stateUt}`,
          users: 0,
          indicators: {},
        };
      }

      const userIds = stateUsers.map((user) => user.id);

      // Get all user indicator scopes for the state users
      const userScopes = await this.userIndicatorScopeRepository
        .createQueryBuilder("scope")
        .leftJoinAndSelect("scope.indicator", "indicator")
        .leftJoinAndSelect("scope.user", "user")
        .where("scope.userId IN (:...userIds)", { userIds })
        .andWhere("indicator.isActive = :isActive", { isActive: true })
        .getMany();

      if (!userScopes || userScopes.length === 0) {
        return {
          message: `No indicator assignments found for state: ${stateUt}`,
          users: stateUsers.length,
          indicators: {},
        };
      }

      // Group indicators by their respective categories/sections
      const groupedIndicators = userScopes.reduce(
        (acc, scope) => {
          const indicator = scope.indicator;
          if (!indicator) return acc;

          const category = indicator.category || "Uncategorized";

          if (!acc[category]) {
            acc[category] = [];
          }

          // Only add unique indicators (avoid duplicates)
          if (!acc[category].some((ind) => ind.id === indicator.id)) {
            acc[category].push({
              id: indicator.id,
              code: indicator.code,
              name: indicator.name,
              category: indicator.category,
              sectionId: indicator.sectionId,
              maxScore: indicator.maxScore,
              assignedUsers: userScopes
                .filter((s) => s.indicatorId === indicator.id)
                .map((s) => ({
                  userId: s.userId,
                  userName: s.user
                    ? `${s.user.firstName} ${s.user.lastName}`
                    : "Unknown",
                })),
            });
          }

          return acc;
        },
        {} as Record<string, any[]>
      );

      return {
        message: `Found indicators for state: ${stateUt}`,
        users: stateUsers.length,
        totalIndicators: Object.values(groupedIndicators).reduce(
          (sum, arr: any[]) => sum + (arr?.length || 0),
          0
        ),
        indicators: groupedIndicators,
      };
    } catch (error) {
      throw new Error(
        `Failed to fetch indicators for state ${stateUt}: ${error.message}`
      );
    }
  }

  async findByCode(code: string): Promise<Indicator> {
    return this.indicatorRepository.findOne({
      where: { code },
    });
  }

  async findBySection(sectionId: string): Promise<Indicator[]> {
    return this.indicatorRepository.find({
      where: { sectionId, isActive: true },
      order: { code: "ASC" },
    });
  }

  async findByCategory(category: string): Promise<Indicator[]> {
    return this.indicatorRepository.find({
      where: { category, isActive: true },
      order: { code: "ASC" },
    });
  }

  async search(
    query: string,
    category?: string,
    isActive?: boolean
  ): Promise<Indicator[]> {
    const queryBuilder =
      this.indicatorRepository.createQueryBuilder("indicator");

    if (query) {
      queryBuilder.where(
        "(indicator.name ILIKE :query OR indicator.code ILIKE :query)",
        { query: `%${query}%` }
      );
    }

    if (category) {
      queryBuilder.andWhere("indicator.category = :category", { category });
    }

    if (isActive !== undefined) {
      queryBuilder.andWhere("indicator.isActive = :isActive", { isActive });
    }

    return queryBuilder.orderBy("indicator.code", "ASC").getMany();
  }

  async getUserIndicators(userId: string): Promise<Indicator[]> {
    const userIndicatorScopes = await this.userIndicatorScopeRepository.find({
      where: { userId },
      relations: ["indicator"],
    });

    return userIndicatorScopes
      .map((scope) => scope.indicator)
      .filter((indicator) => indicator.isActive);
  }

  async getUserIndicatorScopes(userId: string) {
    const userIndicatorScopes = await this.userIndicatorScopeRepository
      .createQueryBuilder("scope")
      .leftJoinAndSelect("scope.indicator", "indicator")
      .where("scope.userId = :userId", { userId })
      .getMany();

    return userIndicatorScopes.map((scope) => ({
      id: scope.id,
      userId: scope.userId,
      indicatorId: scope.indicatorId,
      indicator: {
        id: scope.indicator.id,
        code: scope.indicator.code,
        name: scope.indicator.name,
        category: scope.indicator.category,
        maxScore: scope.indicator.maxScore,
        isActive: scope.indicator.isActive,
      },
      createdAt: scope.createdAt,
    }));
  }

  async assignIndicatorsToUser(
    userId: string,
    indicatorCodes: string[]
  ): Promise<{ message: string; assigned: string[] }> {
    // Verify user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error("User not found");
    }

    // Get indicators by codes
    const indicators = await this.indicatorRepository.find({
      where: { code: In(indicatorCodes) },
    });

    if (indicators.length !== indicatorCodes.length) {
      const foundCodes = indicators.map((ind) => ind.code);
      const missingCodes = indicatorCodes.filter(
        (code) => !foundCodes.includes(code)
      );
      throw new Error(`Indicators not found: ${missingCodes.join(", ")}`);
    }

    // NEW: Find existing assignments for these indicators assigned to OTHER users
    const indicatorIds = indicators.map((ind) => ind.id);
    const existingScopes = await this.userIndicatorScopeRepository.find({
      where: { indicatorId: In(indicatorIds) },
      relations: ["user"],
    });

    // find conflicts: assigned to users other than `userId`
    const conflicts = existingScopes.filter((s) => s.userId !== userId);

    if (conflicts.length > 0) {
      // Map to codes for human message
      const conflictIndicatorIds = conflicts.map((c) => c.indicatorId);
      const conflictIndicators = indicators.filter((i) =>
        conflictIndicatorIds.includes(i.id)
      );
      const conflictCodes = conflictIndicators.map((i) => i.code);
      throw new Error(
        `Indicator(s) already assigned: ${conflictCodes.join(", ")}`
      );
    }

    // Remove existing assignments for this user
    await this.userIndicatorScopeRepository.delete({ userId });

    // Create new assignments
    const assignments = indicators.map((indicator) => ({
      userId,
      indicatorId: indicator.id,
    }));

    await this.userIndicatorScopeRepository.save(assignments);

    return {
      message: "Indicators assigned successfully",
      assigned: indicatorCodes,
    };
  }

  async removeIndicatorsFromUser(
    userId: string,
    indicatorCodes: string[]
  ): Promise<{ message: string; removed: string[] }> {
    // Get indicators by codes
    const indicators = await this.indicatorRepository.find({
      where: { code: In(indicatorCodes) },
    });

    if (indicators.length === 0) {
      return {
        message: "No indicators found to remove",
        removed: [],
      };
    }

    const indicatorIds = indicators.map((ind) => ind.id);

    // Remove assignments
    await this.userIndicatorScopeRepository.delete({
      userId,
      indicatorId: In(indicatorIds),
    });

    return {
      message: "Indicators removed successfully",
      removed: indicatorCodes,
    };
  }

  async getUsersByIndicator(indicatorCode: string): Promise<User[]> {
    const indicator = await this.findByCode(indicatorCode);
    if (!indicator) {
      throw new Error("Indicator not found");
    }

    const userIndicatorScopes = await this.userIndicatorScopeRepository.find({
      where: { indicatorId: indicator.id },
      relations: ["user"],
    });

    return userIndicatorScopes.map((scope) => scope.user);
  }

  async getAvailableIndicatorsForApprover(
      // Debug: Log code-to-id mapping and sets for troubleshooting
    stateUt: string,
    approverUserId?: string
  ) {
    // 0️⃣ If no stateUt passed, infer it from the approver
    const usersInState = await this.userRepository.find({
      where: { stateUt },
      select: ["id", "email", "stateUt"],
    });
    // console.log("👥 Users in this state:", usersInState);

    const scopes = await this.userIndicatorScopeRepository.find({
      where: { userId: In(usersInState.map((u) => u.id)) },
    });
    // console.log("📊 Indicators assigned in this state:", scopes.length);
    if ((!stateUt || !stateUt.trim()) && approverUserId) {
      const approver = await this.userRepository.findOne({
        where: { id: approverUserId },
      });
      stateUt = approver?.stateUt?.trim() || "";
    }

    if (!stateUt) {
      console.warn(
        "⚠️ getAvailableIndicatorsForApprover called without valid stateUt"
      );
      return [];
    }

    // 1️⃣ Get all active indicators
    const allIndicators = await this.indicatorRepository.find({
      where: { isActive: true },
      order: { code: "ASC" },
    });

    // 2️⃣ Find indicatorIds assigned to OTHER STATE_APPROVERs in the same state
    // Only consider active users to ensure indicators from deactivated users are available
    const scopesInState = await this.userIndicatorScopeRepository
      .createQueryBuilder("scope")
      .innerJoin("scope.user", "user")
      .where("user.stateUt = :stateUt", { stateUt })
      .andWhere("user.id != :approverUserId", { approverUserId: approverUserId || "" })
      .andWhere("user.isActive = :isActive", { isActive: true })
      .andWhere("user.role = :stateApproverRole", { stateApproverRole: UserRole.STATE_APPROVER })
      .select(["scope.indicatorId"])
      .getMany();

    // 2.5️⃣ Find indicatorIds assigned to NODAL_OFFICERs in the same state
    // STATE_APPROVERs should only see UNASSIGNED indicators (not assigned to anyone)
    // Use case-insensitive comparison for stateUt to handle formatting differences
    const scopesAssignedToNodalOfficers = await this.userIndicatorScopeRepository
      .createQueryBuilder("scope")
      .innerJoin("scope.user", "user")
      .where("LOWER(TRIM(user.stateUt)) = LOWER(TRIM(:stateUt))", { stateUt })
      .andWhere("user.isActive = :isActive", { isActive: true })
      .andWhere("user.role = :nodalOfficerRole", { nodalOfficerRole: UserRole.NODAL_OFFICER })
      .select(["scope.indicatorId", "scope.userId"])
      .getMany();
    
    console.log(`[getAvailableIndicatorsForApprover] Found ${scopesAssignedToNodalOfficers.length} indicator scopes assigned to NODAL_OFFICERs in state=${stateUt}`);
    if (scopesAssignedToNodalOfficers.length > 0) {
      const userIds = Array.from(new Set(scopesAssignedToNodalOfficers.map(s => s.userId)));
      console.log(`[getAvailableIndicatorsForApprover] These scopes belong to ${userIds.length} NODAL_OFFICER(s): ${userIds.join(', ')}`);
    }

    // 3️⃣ Convert to Sets for filtering
    // This contains indicators assigned to OTHER STATE_APPROVERs
    const assignedToOtherStateApprovers = new Set(
      scopesInState.map((s) => s.indicatorId.toString())
    );
    
    // This contains indicators assigned to NODAL_OFFICERs
    const assignedToNodalOfficers = new Set(
      scopesAssignedToNodalOfficers.map((s) => s.indicatorId.toString())
    );

    console.log(`[getAvailableIndicatorsForApprover] Found ${scopesInState.length} indicators assigned to other STATE_APPROVERs in state=${stateUt}`);
    console.log(`[getAvailableIndicatorsForApprover] Found ${scopesAssignedToNodalOfficers.length} indicators assigned to NODAL_OFFICERs in state=${stateUt}`);
    console.log(`[getAvailableIndicatorsForApprover] Excluded indicator IDs (assigned to other STATE_APPROVERs): [${Array.from(assignedToOtherStateApprovers).join(', ')}]`);
    console.log(`[getAvailableIndicatorsForApprover] Excluded indicator IDs (assigned to NODAL_OFFICERs): [${Array.from(assignedToNodalOfficers).join(', ')}]`);


    // 3.5️⃣ Exclude indicators already ACCEPTED by any state approver in this state
    // IMPORTANT: Only consider indicators accepted from NODAL_OFFICER submissions, NOT from STATE_APPROVER's own submissions

    // Find accepted indicator codes from submissions
    const acceptedCodes = new Set<string>();
    const submissions = await this.submissionRepository.find({
      where: { stateUt, currentOwnerRole: UserRole.STATE_APPROVER, status: SubmissionStatus.SUBMITTED_TO_STATE },
      relations: ["user"], // Add relation to check submittedBy role
    });
    
    console.log(`[getAvailableIndicatorsForApprover] Checking ${submissions.length} submissions for accepted indicators in state=${stateUt}`);
    
    for (const submission of submissions) {
      // Only consider submissions from NODAL_OFFICERs, not from STATE_APPROVERs
      // STATE_APPROVERs should be able to see and work with their own submitted indicators
      if (submission.user?.role !== UserRole.NODAL_OFFICER) {
        console.log(`[getAvailableIndicatorsForApprover] Skipping submission ${submission.submissionId} - submitted by ${submission.user?.role} (not NODAL_OFFICER)`);
        continue;
      }
      
      // Get the NODAL_OFFICER's currently assigned indicators
      // Only exclude accepted indicators if they're still assigned to this NODAL_OFFICER
      const nodalOfficerId = submission.user.id;
      const nodalOfficerScopes = await this.userIndicatorScopeRepository.find({
        where: { userId: nodalOfficerId },
        relations: ["indicator"],
      });
      const currentlyAssignedCodes = new Set(
        nodalOfficerScopes
          .map(scope => scope.indicator?.code)
          .filter(Boolean) as string[]
      );
      
      const formData = submission.formData || {};
      Object.entries(formData).forEach(([parentKey, parentData]: [string, any]) => {
        if (typeof parentData !== "object" || parentData === null) return;
        Object.entries(parentData).forEach(([sectionKey, data]: [string, any]) => {
          if (data && typeof data === "object" && data.status === "ACCEPTED") {
            let code = sectionKey;
            if (code.startsWith("section")) {
              // Handle section format: section4_2 -> 4.2, section1_1 -> 1.1
              // Remove "section" prefix and replace ALL underscores with dots
              code = code.replace(/^section/, "").replace(/_/g, ".");
            }
            
            // Validate the code format (should be like "1.1", "4.2", etc.)
            if (/^\d+\.\d+$/.test(code)) {
              // Only exclude if the indicator is still assigned to this NODAL_OFFICER
              // If it was removed, it should become available again for STATE_APPROVER
              if (currentlyAssignedCodes.has(code)) {
                acceptedCodes.add(code);
                console.log(`[getAvailableIndicatorsForApprover] Found accepted indicator: ${code} from sectionKey: ${sectionKey} in submission: ${submission.submissionId} (from NODAL_OFFICER, still assigned)`);
              } else {
                console.log(`[getAvailableIndicatorsForApprover] Skipping accepted indicator: ${code} from sectionKey: ${sectionKey} in submission: ${submission.submissionId} - no longer assigned to NODAL_OFFICER, will be available`);
              }
            } else {
              console.warn(`[getAvailableIndicatorsForApprover] Invalid indicator code format: ${code} from sectionKey: ${sectionKey} in submission: ${submission.submissionId}`);
            }
          }
        });
      });
    }

    console.log(`[getAvailableIndicatorsForApprover] Accepted indicator codes: [${Array.from(acceptedCodes).join(', ')}]`);

    // 3.6️⃣ Exclude indicators from STATE_APPROVER's own submitted consolidated submissions
    // If a state approver has already submitted their consolidated submission, those indicators should not be available
    const submittedByStateApproverCodes = new Set<string>();
    
    // First, let's find all STATE_APPROVER users in this state to get their IDs
    const stateApproverUsers = await this.userRepository.find({
      where: {
        stateUt: stateUt,
        role: UserRole.STATE_APPROVER,
        isActive: true
      },
      select: ["id"]
    });
    const stateApproverUserIds = stateApproverUsers.map(u => u.id);
    console.log(`[getAvailableIndicatorsForApprover] Found ${stateApproverUserIds.length} STATE_APPROVER users in state=${stateUt}: ${stateApproverUserIds.join(', ')}`);
    
    // Query submissions by submittedBy field (which is the actual creator) and also check user role
    // Use case-insensitive comparison for stateUt to handle formatting differences
    // Include all statuses that indicate the submission has been submitted (not just final statuses)
    const stateApproverSubmissions = await this.submissionRepository
      .createQueryBuilder("submission")
      .innerJoinAndSelect("submission.user", "user")
      .where("(submission.submittedBy IN (:...stateApproverIds) OR user.role = :stateApproverRole)", {
        stateApproverIds: stateApproverUserIds.length > 0 ? stateApproverUserIds : [''],
        stateApproverRole: UserRole.STATE_APPROVER
      })
      .andWhere("(LOWER(TRIM(submission.stateUt)) = LOWER(TRIM(:stateUt)) OR LOWER(TRIM(user.stateUt)) = LOWER(TRIM(:stateUt)))", { stateUt })
      .andWhere("submission.status IN (:...statuses)", {
        statuses: [
          SubmissionStatus.SUBMITTED_TO_STATE, // Include this in case state approver submission has this status
          SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
          SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER,
          SubmissionStatus.APPROVED
        ]
      })
      .getMany();

    console.log(`[getAvailableIndicatorsForApprover] Found ${stateApproverSubmissions.length} submitted consolidated submissions from STATE_APPROVERs in state=${stateUt}`);
    if (stateApproverSubmissions.length > 0) {
      console.log(`[getAvailableIndicatorsForApprover] Submission IDs: ${stateApproverSubmissions.map(s => s.submissionId).join(', ')}`);
      console.log(`[getAvailableIndicatorsForApprover] Submission statuses: ${stateApproverSubmissions.map(s => s.status).join(', ')}`);
      console.log(`[getAvailableIndicatorsForApprover] Submission submittedBy: ${stateApproverSubmissions.map(s => s.submittedBy).join(', ')}`);
      console.log(`[getAvailableIndicatorsForApprover] Submission user IDs: ${stateApproverSubmissions.map(s => s.user?.id).join(', ')}`);
      console.log(`[getAvailableIndicatorsForApprover] Submission user roles: ${stateApproverSubmissions.map(s => s.user?.role).join(', ')}`);
    } else {
      // Debug: Let's also check what submissions exist for this state
      const allSubmissionsInState = await this.submissionRepository.find({
        where: [
          { stateUt: stateUt },
        ],
        relations: ["user"],
        take: 10 // Limit to first 10 for debugging
      });
      console.log(`[getAvailableIndicatorsForApprover] DEBUG: Found ${allSubmissionsInState.length} total submissions in state=${stateUt}`);
      allSubmissionsInState.forEach(sub => {
        console.log(`[getAvailableIndicatorsForApprover] DEBUG: Submission ${sub.submissionId} - status: ${sub.status}, user.role: ${sub.user?.role}, submittedBy: ${sub.submittedBy}, stateUt: ${sub.stateUt}`);
      });
    }

    for (const submission of stateApproverSubmissions) {
      // Only consider submissions from STATE_APPROVERs
      if (submission.user?.role !== UserRole.STATE_APPROVER) {
        console.log(`[getAvailableIndicatorsForApprover] Skipping submission ${submission.submissionId} - user role is ${submission.user?.role}, not STATE_APPROVER`);
        continue;
      }

      console.log(`[getAvailableIndicatorsForApprover] Processing submission ${submission.submissionId} from STATE_APPROVER ${submission.user?.id}`);
      const formData = submission.formData || {};
      
      // Extract indicators from formData
      // Check each category (infraFinancing, infraDevelopment, pppDevelopment, infraEnablers)
      const categoryKeys = ["infraFinancing", "infraDevelopment", "pppDevelopment", "infraEnablers"];
      
      categoryKeys.forEach((categoryKey) => {
        if (formData[categoryKey] && typeof formData[categoryKey] === "object") {
          const categoryData = formData[categoryKey];
          console.log(`[getAvailableIndicatorsForApprover] Checking category ${categoryKey}, found ${Object.keys(categoryData).length} sections`);
          
          // Check each section within the category
          Object.keys(categoryData).forEach((sectionKey) => {
            // Convert section key to indicator code (e.g., "section1_1" -> "1.1")
            if (sectionKey.startsWith("section")) {
              const indicatorCode = sectionKey
                .replace(/^section/, "")
                .replace(/_/g, ".");
              
              // Validate the code format (should be like "1.1", "4.2", etc.)
              if (/^\d+\.\d+$/.test(indicatorCode)) {
                const sectionData = categoryData[sectionKey];
                // Only include if section has meaningful data
                if (sectionData && typeof sectionData === "object" && Object.keys(sectionData).length > 0) {
                  submittedByStateApproverCodes.add(indicatorCode);
                  console.log(`[getAvailableIndicatorsForApprover] Found submitted indicator: ${indicatorCode} from STATE_APPROVER submission ${submission.submissionId} in category ${categoryKey}`);
                } else {
                  console.log(`[getAvailableIndicatorsForApprover] Skipping indicator ${indicatorCode} - section has no meaningful data`);
                }
              } else {
                console.log(`[getAvailableIndicatorsForApprover] Invalid indicator code format: ${indicatorCode} from sectionKey: ${sectionKey}`);
              }
            }
          });
        } else {
          console.log(`[getAvailableIndicatorsForApprover] Category ${categoryKey} not found or not an object in submission ${submission.submissionId}`);
        }
      });
    }

    console.log(`[getAvailableIndicatorsForApprover] Submitted by STATE_APPROVER indicator codes: [${Array.from(submittedByStateApproverCodes).join(', ')}]`);

    // Map acceptedCodes and submittedByStateApproverCodes to indicator IDs
    const codeToId = new Map<string, string>();
    allIndicators.forEach(ind => {
      codeToId.set(ind.code, ind.id.toString());
    });
    const acceptedIds = new Set<string>();
    acceptedCodes.forEach(code => {
      const id = codeToId.get(code);
      if (id) {
        acceptedIds.add(id);
        console.log(`[getAvailableIndicatorsForApprover] Mapped accepted code ${code} to indicator ID: ${id}`);
      } else {
        console.warn(`[getAvailableIndicatorsForApprover] Could not find indicator ID for accepted code: ${code}`);
      }
    });

    const submittedByStateApproverIds = new Set<string>();
    submittedByStateApproverCodes.forEach(code => {
      const id = codeToId.get(code);
      if (id) {
        submittedByStateApproverIds.add(id);
        console.log(`[getAvailableIndicatorsForApprover] Mapped submitted code ${code} to indicator ID: ${id}`);
      } else {
        console.warn(`[getAvailableIndicatorsForApprover] Could not find indicator ID for submitted code: ${code}`);
      }
    });

    // Check if indicator 4.2 is being excluded and why (for debugging)
    const indicator42 = allIndicators.find(ind => ind.code === "4.2");
    if (indicator42) {
      const indicator42Id = indicator42.id.toString();
      const isAssignedToOtherStateApprover = assignedToOtherStateApprovers.has(indicator42Id);
      const isAccepted = acceptedIds.has(indicator42Id);
      const isSubmittedByStateApprover = submittedByStateApproverIds.has(indicator42Id);
      console.log(`[getAvailableIndicatorsForApprover] Indicator 4.2 status: id=${indicator42Id}, assignedToOtherStateApprover=${isAssignedToOtherStateApprover}, accepted=${isAccepted}, submittedByStateApprover=${isSubmittedByStateApprover}, willBeExcluded=${isAssignedToOtherStateApprover || isAccepted || isSubmittedByStateApprover}`);
    }

    // Merge assignedToOtherStateApprovers, assignedToNodalOfficers, acceptedIds, and submittedByStateApproverIds
    // STATE_APPROVERs should only see UNASSIGNED indicators (not assigned to anyone and not already submitted)
    const excludedIds = new Set<string>([
      ...assignedToOtherStateApprovers,
      ...assignedToNodalOfficers,
      ...acceptedIds,
      ...submittedByStateApproverIds
    ]);

    console.log(`[getAvailableIndicatorsForApprover] Total excluded indicator IDs: [${Array.from(excludedIds).join(', ')}]`);
    console.log(`[getAvailableIndicatorsForApprover] Excluded indicator codes: [${Array.from(excludedIds).map(id => {
      const indicator = allIndicators.find(ind => ind.id.toString() === id);
      return indicator ? indicator.code : id;
    }).join(', ')}]`);

    // 4️⃣ Keep indicators NOT in excludedIds
    // This includes ONLY:
    // - Indicators not assigned to anyone (neither NODAL_OFFICERs nor STATE_APPROVERs)
    // - Indicators not already accepted
    // NOTE: Indicators assigned to NODAL_OFFICERs are now EXCLUDED - STATE_APPROVERs only see unassigned indicators
    const available = allIndicators.filter(
      (ind) => !excludedIds.has(ind.id.toString())
    );

    console.log(
     // `🟢 Found ${available.length} available indicators for state=${stateUt}`
    );
    console.log(`[getAvailableIndicatorsForApprover] Available indicator codes: [${available.map(ind => ind.code).join(', ')}]`);

    return available.map((ind) => ({
      id: ind.id,
      code: ind.code,
      name: ind.name,
      category: ind.category,
      isActive: ind.isActive,
    }));
  }

  /**
   * Get indicator statuses from nodal officers' submissions in the state approver's state
   * @param currentUserId string - The state approver's user ID
   */
  //   async getStateIndicatorStatuses(currentUserId: string, year?: string): Promise<any> {
  //     try {
  //       const stateApprover = await this.userRepository.findOne({
  //         where: {
  //           id: currentUserId,
  //           role: UserRole.STATE_APPROVER
  //         }
  //       });

  //       if (!stateApprover) {
  //         throw new Error('User not found or not a state approver');
  //       }

  //       const APPROVED = new Set(["APPROVED", "ACCEPTED"]);

  //        const pathToCode = (path?: string): string | null => {
  //       if (!path) return null;
  //       const m = path.match(/section(\d+)_(\d+)/i);
  //       return m ? `${m[1]}.${m[2]}` : null;
  //     };

  //      const normalizeCode = (row: any): string | null => {
  //       const raw = String(row?.code ?? "").trim();
  //       if (/^\d+(\.\d+)*$/.test(raw)) return raw;

  //       const sectionKey = String(row?.sectionKey ?? "").trim();
  //       if (sectionKey.startsWith("section")) {
  //         const candidate = sectionKey.replace(/^section/, "").replace("_", ".");
  //         return /^\d+(\.\d+)*$/.test(candidate) ? candidate : null;
  //       }
  //       if (/^\d+(\.\d+)*$/.test(sectionKey)) return sectionKey;

  //       const path = String(row?.path ?? (row?.parentKey && row?.sectionKey ? `${row.parentKey}.${row.sectionKey}` : "")).trim();
  //       const fromPath = pathToCode(path);
  //       return fromPath ?? null;
  //     };
  //       // const whereClause: any = {
  //       //   submittedBy: currentUserId
  //       // };
  //       // if (year) {
  //       //   const startDate = new Date(year);
  //       //   const endDate = new Date(parseInt(year) + 1, 0, 1);
  //       //   whereClause.createdAt = {
  //       //     gte: startDate,
  //       //     lt: endDate
  //       //   };
  //       // }

  //       const whereClause: any = { stateUt: stateApprover.stateUt ,  currentOwnerRole: 'STATE_APPROVER',
  //       status: 'SUBMITTED_TO_STATE',};
  //     if (year) {
  //       // Use TypeORM Between or raw; shown here with raw Date bounds
  //       const start = new Date(`${year}-01-01T00:00:00.000Z`);
  //       const end = new Date(`${Number(year) + 1}-01-01T00:00:00.000Z`);
  //       whereClause.createdAt = { $gte: start, $lt: end } as any; // adapt if using DataSource.query/Between
  //     }

  //       const submissions = await this.submissionRepository.find({
  //         where: whereClause,
  //         relations: ['user'],
  //         order: {
  //           createdAt: 'DESC'
  //         }
  //       });

  //       const processedSubmissions = submissions.map(submission => {
  //         // const formData = submission.formData || {};
  //         // const statuses = [];

  //         const formData: any = submission.formData || {};
  //       const statuses: any[] = [];

  //         Object.entries(formData).forEach(([parentKey, parentData]: [string, any]) => {
  //           if (typeof parentData !== 'object' || parentData === null) return;

  //           Object.entries(parentData).forEach(([sectionKey, data]: [string, any]) => {
  //             // For array data (like projects)
  //             // if (Array.isArray(data)) {
  //             //   statuses.push({
  //             //     path: `${parentKey}.${sectionKey}`,
  //             //     parentKey,
  //             //     sectionKey,
  //             //     data
  //             //   });
  //             //   return;
  //             // }

  //              const base = {
  //             path: `${parentKey}.${sectionKey}`,
  //             parentKey,
  //             sectionKey,
  //           };

  //           if (Array.isArray(data)) {
  //             statuses.push({ ...base, data });
  //             return;
  //           }

  //             // For object data with status or other fields
  //         //     if (typeof data === 'object' && data !== null) {
  //         //       statuses.push({
  //         //         path: `${parentKey}.${sectionKey}`,
  //         //         parentKey,
  //         //         sectionKey,
  //         //         ...data
  //         //       });
  //         //     }
  //         //   });
  //         // });

  //           if (typeof data === "object" && data !== null) {
  //             // include status if present for acceptance checks
  //             statuses.push({ ...base, ...data });
  //           }
  //         });
  //       });

  //       //   return {
  //       //     submissionId: submission.submissionId,
  //       //     nodalOfficer: {
  //       //       id: submission.user.id,
  //       //       name: `${submission.user.firstName} ${submission.user.lastName}`,
  //       //       email: submission.user.email,
  //       //       role: submission.user.role
  //       //     },
  //       //     statuses,
  //       //     submittedAt: submission.createdAt,
  //       //     formData
  //       //   };
  //       // });

  //        return {
  //         submissionId: submission.submissionId,
  //         nodalOfficer: {
  //           id: submission.user?.id,
  //           name: `${submission.user?.firstName ?? ""} ${submission.user?.lastName ?? ""}`.trim(),
  //           email: submission.user?.email,
  //           role: submission.user?.role,
  //         },
  //         statuses,
  //         submittedAt: submission.createdAt,
  //         formData,
  //       };
  //     });

  //     // ---------- Compute cumulative accepted counts (dedupe by indicator code)
  //     const allActiveIndicators = await this.indicatorRepository.find({
  //       where: { isActive: true },
  //       order: { code: "ASC" },
  //     });
  //     const totalIndicators = allActiveIndicators.length;
  //     const validCodes = new Set(allActiveIndicators.map((i) => i.code));

  //     const acceptedCodes = new Set<string>();

  //     for (const sub of processedSubmissions) {
  //       for (const st of sub.statuses ?? []) {
  //         // acceptance can be on this flattened object as st.status
  //         const statusVal = String(st?.status ?? "").toUpperCase();
  //         if (!APPROVED.has(statusVal)) continue;

  //         const code = normalizeCode(st) || pathToCode(st?.path);
  //         if (code && validCodes.has(code)) {
  //           acceptedCodes.add(code);
  //         }
  //       }
  //     }

  //     const acceptedCount = acceptedCodes.size;
  //     const percentage = totalIndicators ? Math.round((acceptedCount / totalIndicators) * 100) : 0;

  //   //     return {
  //   //       stateUt: stateApprover.stateUt,
  //   //       submissions: processedSubmissions
  //   //     };
  //   //   } catch (error) {
  //   //     throw new Error(`Failed to fetch state indicator statuses: ${error.message}`);
  //   //   }
  //   // }

  //    return {
  //       stateUt: stateApprover.stateUt,
  //       submissions: processedSubmissions,
  //       summary: {
  //         totalSubmissions: processedSubmissions.length,
  //         totalIndicators,
  //         acceptedCount,
  //         percentage,
  //         allAccepted: acceptedCount === totalIndicators,
  //         lastUpdated: processedSubmissions[0]?.submittedAt ?? null,
  //       },
  //     };
  //   } catch (error) {
  //     throw new Error(`Failed to fetch state indicator statuses: ${error.message}`);
  //   }
  // }

  async getStateIndicatorStatuses(
    currentUserId: string,
    year?: string
  ): Promise<any> {
    try {
      const stateApprover = await this.userRepository.findOne({
        where: { id: currentUserId, role: UserRole.STATE_APPROVER },
      });
      if (!stateApprover) {
        throw new Error("User not found or not a state approver");
      }

      const APPROVED = new Set(["APPROVED", "ACCEPTED"]);

      // "infraFinancing.section1_2" -> "1.2"
      const pathToCode = (path?: string): string | null => {
        if (!path) return null;
        const m = path.match(/section(\d+)_(\d+)/i);
        return m ? `${m[1]}.${m[2]}` : null;
      };

      // Try to read a canonical indicator code ("x.y") from a row
      const normalizeCode = (row: any): string | null => {
        const raw = String(row?.code ?? "").trim();
        if (/^\d+(\.\d+)*$/.test(raw)) return raw;

        const sectionKey = String(row?.sectionKey ?? "").trim();
        if (sectionKey.startsWith("section")) {
          const candidate = sectionKey
            .replace(/^section/, "")
            .replace("_", ".");
          return /^\d+(\.\d+)*$/.test(candidate) ? candidate : null;
        }
        if (/^\d+(\.\d+)*$/.test(sectionKey)) return sectionKey;

        const path = String(
          row?.path ??
            (row?.parentKey && row?.sectionKey
              ? `${row.parentKey}.${row.sectionKey}`
              : "")
        ).trim();
        return pathToCode(path);
      };

      // ✅ Only submissions currently under the State Approver stage
      const where: any = {
        stateUt: stateApprover.stateUt,
        currentOwnerRole: "STATE_APPROVER",
        status: "SUBMITTED_TO_STATE",
      };

      // Year filter (use TypeORM Between)
      if (year) {
        const start = new Date(`${year}-01-01T00:00:00.000Z`);
        const end = new Date(`${Number(year) + 1}-01-01T00:00:00.000Z`);
        where.createdAt = Between(start, end);
      }

      const submissions = await this.submissionRepository.find({
        where,
        relations: ["user"],
        order: { createdAt: "DESC" },
      });

      const processedSubmissions = submissions.map((submission) => {
        const formData: any = submission.formData ?? {};
        const statuses: any[] = [];

        Object.entries(formData).forEach(
          ([parentKey, parentData]: [string, any]) => {
            if (typeof parentData !== "object" || parentData === null) return;

            Object.entries(parentData).forEach(
              ([sectionKey, data]: [string, any]) => {
                const base = {
                  path: `${parentKey}.${sectionKey}`,
                  parentKey,
                  sectionKey,
                };

                if (Array.isArray(data)) {
                  statuses.push({ ...base, data });
                  return;
                }
                if (typeof data === "object" && data !== null) {
                  statuses.push({ ...base, ...data });
                }
              }
            );
          }
        );

        return {
          submissionId: submission.submissionId,
          nodalOfficer: {
            id: submission.user?.id,
            name: `${submission.user?.firstName ?? ""} ${submission.user?.lastName ?? ""}`.trim(),
            email: submission.user?.email,
            role: submission.user?.role,
          },
          statuses,
          submittedAt: submission.createdAt,
          formData,
        };
      });

      // 🧮 Calculate cumulative accepted count (dedupe by indicator code)
      const allActiveIndicators = await this.indicatorRepository.find({
        where: { isActive: true },
        order: { code: "ASC" },
      });
      const totalIndicators = allActiveIndicators.length;
      const validCodes = new Set(allActiveIndicators.map((i) => i.code));

      const acceptedCodes = new Set<string>();
      for (const sub of processedSubmissions) {
        for (const st of sub.statuses ?? []) {
          const statusVal = String(st?.status ?? "").toUpperCase();
          if (!APPROVED.has(statusVal)) continue;

          const code = normalizeCode(st);
          if (code && validCodes.has(code)) {
            acceptedCodes.add(code);
          }
        }
      }

      const acceptedCount = acceptedCodes.size;
      const percentage = totalIndicators
        ? Math.round((acceptedCount / totalIndicators) * 100)
        : 0;

      return {
        stateUt: stateApprover.stateUt,
        submissions: processedSubmissions,
        summary: {
          totalSubmissions: processedSubmissions.length,
          totalIndicators,
          acceptedCount,
          percentage,
          allAccepted: acceptedCount === totalIndicators,
          lastUpdated: processedSubmissions[0]?.submittedAt ?? null,
        },
      };
    } catch (error) {
      throw new Error(
        `Failed to fetch state indicator statuses: ${error.message}`
      );
    }
  }

  async getIndicatorStatistics(): Promise<{
    totalIndicators: number;
    activeIndicators: number;
    inactiveIndicators: number;
    totalAssignments: number;
    categoryStats: any[];
  }> {
    const totalIndicators = await this.indicatorRepository.count();
    const activeIndicators = await this.indicatorRepository.count({
      where: { isActive: true },
    });
    const totalAssignments = await this.userIndicatorScopeRepository.count();

    const categoryStats = await this.indicatorRepository
      .createQueryBuilder("indicator")
      .select("indicator.category", "category")
      .addSelect("COUNT(*)", "count")
      .where("indicator.isActive = :isActive", { isActive: true })
      .groupBy("indicator.category")
      .getRawMany();

    return {
      totalIndicators,
      activeIndicators,
      inactiveIndicators: totalIndicators - activeIndicators,
      totalAssignments,
      categoryStats,
    };
  }

  async getUsageReport(): Promise<any[]> {
    return this.userIndicatorScopeRepository
      .createQueryBuilder("scope")
      .leftJoin("scope.indicator", "indicator")
      .leftJoin("scope.user", "user")
      .select("indicator.code", "indicatorCode")
      .addSelect("indicator.name", "indicatorName")
      .addSelect("indicator.category", "category")
      .addSelect("COUNT(scope.userId)", "userCount")
      .groupBy(
        "indicator.id, indicator.code, indicator.name, indicator.category"
      )
      .orderBy("userCount", "DESC")
      .getRawMany();
  }
}