import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { Indicator } from "../../entities/indicator.entity";
import { UserIndicatorScope } from "../../entities/user-indicator-scope.entity";
import { User, UserRole } from "../../entities/user.entity";
import { Submission } from '../../entities/submission.entity';

@Injectable()
export class IndicatorService {
  constructor(
    @InjectRepository(Indicator)
    private indicatorRepository: Repository<Indicator>,
    @InjectRepository(UserIndicatorScope)
    private userIndicatorScopeRepository: Repository<UserIndicatorScope>,
    @InjectRepository(User)
    private userRepository: Repository<User>
    ,@InjectRepository(Submission)
    private submissionRepository: Repository<Submission>
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
    const submission = await this.submissionRepository.findOne({ where: { submissionId } });
    if (!submission) {
      throw new Error('Submission not found');
    }
    const formData = submission.formData || {};
    if (!formData[parentKey] || !formData[parentKey][sectionKey]) {
      throw new Error('Parent key or section key not found in form data');
    }
    if (!(field in formData[parentKey][sectionKey])) {
      throw new Error('Field not found in section data');
    }
    return {
      parentKey,
      sectionKey,
      field,
      value: formData[parentKey][sectionKey][field]
    };
  }

  async getIndicatorsByStatus(submissionId: string, status: string): Promise<any> {
    const submission = await this.submissionRepository.findOne({ where: { submissionId } });
    if (!submission) {
      throw new Error('Submission not found');
    }
    
    const formData = submission.formData || {};
    const result: any[] = [];
    
    const searchForStatus = (obj: any, path: string[] = []) => {
      for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          searchForStatus(obj[key], [...path, key]);
        } else if (key === 'status' && obj[key] === status) {
          const sectionData = {
            path: path.join('.'),
            parentKey: path[0],
            sectionKey: path[1],
            status: obj[key],
            ...obj
          };
          result.push(sectionData);
        }
      }
    };
    
    searchForStatus(formData);
    
    return {
      submissionId,
      indicators: result
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
  stateUt: string,
  approverUserId?: string
) {
  // 0️⃣ If no stateUt passed, infer it from the approver
  const usersInState = await this.userRepository.find({
  where: { stateUt },
  select: ["id", "email", "stateUt"],
});
console.log("👥 Users in this state:", usersInState);

const scopes = await this.userIndicatorScopeRepository.find({
  where: { userId: In(usersInState.map((u) => u.id)) },
});
console.log("📊 Indicators assigned in this state:", scopes.length);
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

  // 2️⃣ Find indicatorIds assigned to OTHER users in the same state
  const scopesInState = await this.userIndicatorScopeRepository
    .createQueryBuilder("scope")
    .innerJoin("scope.user", "user")
    .where("user.stateUt = :stateUt", { stateUt })
    .andWhere("user.id != :approverUserId", { approverUserId })
    .select(["scope.indicatorId"])
    .getMany();

  // 3️⃣ Convert to a Set for filtering
  const assignedToOthers = new Set(
    scopesInState.map((s) => s.indicatorId.toString())
  );

  // 4️⃣ Keep indicators NOT already assigned
  const available = allIndicators.filter(
    (ind) => !assignedToOthers.has(ind.id.toString())
  );

  console.log(
    `🟢 Found ${available.length} available indicators for state=${stateUt}`
  );

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
  async getStateIndicatorStatuses(currentUserId: string): Promise<any> {
    // 1. Get the state approver's details
    const stateApprover = await this.userRepository.findOne({ 
      where: { 
        id: currentUserId,
        role: UserRole.STATE_APPROVER 
      } 
    });

    if (!stateApprover) {
      throw new Error('User not found or not a state approver');
    }

    // 2. Find all nodal officers in the same state
    const nodalOfficers = await this.userRepository.find({
      where: {
        stateUt: stateApprover.stateUt,
        role: UserRole.NODAL_OFFICER
      }
    });

    if (!nodalOfficers.length) {
      return {
        stateUt: stateApprover.stateUt,
        submissions: []
      };
    }

    // 3. Get submissions from these nodal officers
    const submissions = await this.submissionRepository.find({
      where: {
        submittedBy: In(nodalOfficers.map(officer => officer.id))
      },
      relations: ['user']  // Include user details
    });

    // 4. Process each submission to extract indicator statuses
    const processedSubmissions = submissions.map(submission => {
      const formData = submission.formData || {};
      const statuses: any[] = [];

      const extractStatuses = (obj: any, path: string[] = []) => {
        for (const key in obj) {
          if (typeof obj[key] === 'object' && obj[key] !== null) {
            extractStatuses(obj[key], [...path, key]);
          } else if (key === 'status') {
            statuses.push({
              path: path.join('.'),
              parentKey: path[0],
              sectionKey: path[1],
              status: obj[key],
              ...obj
            });
          }
        }
      };

      extractStatuses(formData);

      return {
        submissionId: submission.submissionId,
        nodalOfficer: {
          id: submission.user.id,
          name: `${submission.user.firstName} ${submission.user.lastName}`,
          email: submission.user.email
        },
        statuses
      };
    });

    return {
      stateUt: stateApprover.stateUt,
      submissions: processedSubmissions
    };
  }

  async getIndicatorStatistics(): Promise<any> {
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

  async getUsageReport(): Promise<any> {
    const usageStats = await this.userIndicatorScopeRepository
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

    return usageStats;
  }
}
