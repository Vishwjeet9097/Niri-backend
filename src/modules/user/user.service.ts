import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Not, DataSource, In } from "typeorm";
import { User, UserRole } from "../../entities/user.entity";
import { Indicator } from "../../entities/indicator.entity";
import { UserIndicatorScope } from "../../entities/user-indicator-scope.entity";
import { Submission } from "../../entities/submission.entity";
import { FinalScore } from "../../entities/final-score.entity";
import { AuditLog } from "../../entities/audit-log.entity";
import { UpdateUserDto, CreateUserDto } from "../auth/dto/auth.dto";
import * as bcrypt from "bcryptjs";

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  // Get all users by each role with isActive=true
  async getAllActiveUsersByRole(): Promise<Record<UserRole, any[]>> {
      const roles: UserRole[] = [
        UserRole.NODAL_OFFICER,
        UserRole.STATE_APPROVER,
        UserRole.MOSPI_REVIEWER,
        UserRole.MOSPI_APPROVER,
        UserRole.ADMIN,
      ];

      const result: Record<UserRole, any[]> = {} as any;
      for (const role of roles) {
        const users = await this.userRepository.find({
          where: { role, isActive: true },
          select: [
            "id",
            "email",
            "firstName",
            "lastName",
            "contactNumber",
            "role",
            "stateUt",
            "isActive",
            "createdAt",
          ],
          order: { createdAt: "DESC" },
        });
        result[role] = users;
      }
      return result;
    }
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Indicator)
    private indicatorRepository: Repository<Indicator>,
    @InjectRepository(UserIndicatorScope)
    private userIndicatorScopeRepository: Repository<UserIndicatorScope>,
    @InjectRepository(Submission)
    private submissionRepository: Repository<Submission>,
    private dataSource: DataSource
  ) {}

  async findAll(
    userRole: UserRole,
    userStateUt: string,
    userId?: string
  ): Promise<any[]> {
    let query = this.userRepository
      .createQueryBuilder("user")
      .select([
        "user.id",
        "user.email",
        "user.firstName",
        "user.lastName",
        "user.contactNumber",
        "user.role",
        "user.stateUt",
        "user.isActive",
        "user.createdAt",
      ])
      .where("user.isActive = :isActive", { isActive: true })
      .andWhere("user.role != :adminRole", { adminRole: UserRole.ADMIN })
      .orderBy("user.firstName", "ASC")
      .addOrderBy("user.lastName", "ASC");

    // Hide logged-in user from the list
    if (userId) {
      query = query.andWhere("user.id != :userId", { userId });
    }

    // Only ADMIN can see all users, others can only see users from their state
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.MOSPI_APPROVER) {
      query = query.andWhere("user.stateUt = :stateUt", {
        stateUt: userStateUt,
      });
    }

    // Only STATE_APPROVER can see NODAL_OFFICER users, others cannot see them
    if (userRole !== UserRole.STATE_APPROVER) {
      query = query.andWhere("user.role != :nodalRole", {
        nodalRole: UserRole.NODAL_OFFICER,
      });
    } else {
      // STATE_APPROVER can only see NODAL_OFFICER users
      query = query.andWhere("user.role = :nodalRole", {
        nodalRole: UserRole.NODAL_OFFICER,
      });
    }

    const users = await query.getMany();

    // Get indicators for each user
    const usersWithIndicators = await Promise.all(
      users.map(async (user) => {
        const indicators = await this.getUserIndicatorScopes(user.id);
        return {
          ...user,
          assignedIndicators: indicators,
        };
      })
    );

    return usersWithIndicators;
  }

  async findOne(
    id: string,
    userRole: UserRole,
    userStateUt: string
  ): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      select: [
        "id",
        "email",
        "firstName",
        "lastName",
        "contactNumber",
        "role",
        "stateUt",
        "isActive",
        "createdAt",
      ],
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Hide ADMIN users from all roles (including ADMIN itself)
    if (user.role === UserRole.ADMIN) {
      throw new NotFoundException("User not found");
    }

    // Only ADMIN can access users from any state, others can only access users from their state
    if (userRole !== UserRole.ADMIN && user.stateUt !== userStateUt) {
      // throw new ForbiddenException("Access denied");
    }

    return user;
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    userRole: UserRole,
    userStateUt: string
  ): Promise<User> {
    const user = await this.findOne(id, userRole, userStateUt);

    // Admin, State Approver and MoSPI roles can change user roles
    if (
      updateUserDto.role &&
      ![
        UserRole.ADMIN,
        UserRole.STATE_APPROVER,
        UserRole.MOSPI_REVIEWER,
        UserRole.MOSPI_APPROVER,
      ].includes(userRole)
    ) {
      throw new ForbiddenException(
        "Only Admin, State Approver and MoSPI roles can change user roles"
      );
    }

    // State/UT approvers cannot change state_ut
    // if (updateUserDto.stateUt && userRole === UserRole.STATE_APPROVER) {
    // throw new ForbiddenException("Cannot change state/UT");
    // }

    // Handle indicator codes separately
    const { indicatorCodes, ...userUpdateData } = updateUserDto;

    // Filter out any invalid properties that don't exist in User entity
    const updateData = { ...userUpdateData };
    // Remove stateId if it exists, as User entity has stateUt
    if ("stateId" in updateData) {
      //  delete updateData.stateId;
    }

    // Update user basic information
    await this.userRepository.update(id, updateData);

    // Handle indicator codes if provided
    if (indicatorCodes !== undefined) {
      await this.updateUserIndicatorCodes(id, indicatorCodes);
    }

    return this.findOne(id, userRole, userStateUt);
  }

  async deactivate(
    id: string,
    userRole: UserRole,
    userStateUt: string
  ): Promise<void> {
    await this.findOne(id, userRole, userStateUt);

    // Admin, State Approver and MoSPI roles can deactivate users
    if (
      ![
        UserRole.ADMIN,
        UserRole.STATE_APPROVER,
        UserRole.MOSPI_REVIEWER,
        UserRole.MOSPI_APPROVER,
      ].includes(userRole)
    ) {
      throw new ForbiddenException(
        "Only Admin, State Approver and MoSPI roles can deactivate users"
      );
    }

    // Check if the user has any submissions
    // If they do, prevent deletion
    const submissionCount = await this.submissionRepository.count({
      where: { submittedBy: id },
    });

    if (submissionCount > 0) {
      throw new BadRequestException(
        `Cannot delete nodal officer. This user has ${submissionCount} submission(s) associated with them. Please remove or reassign the submissions before deleting.`
      );
    }

    // Use transaction to ensure both operations happen atomically
    await this.dataSource.transaction(async (manager) => {
      // Delete all indicator scope assignments for this user first
      // This ensures indicators become available again for the state approver
      await manager.delete(UserIndicatorScope, { userId: id });

      // Hard delete the user since they have no submissions
      await manager.delete(User, id);
    });
  }

  async bulkDeactivate(
    userIds: string[],
    userRole: UserRole,
    userStateUt: string
  ): Promise<{
    successCount: number;
    failedCount: number;
    errors: Array<{ userId: string; error: string }>;
  }> {
    // Only ADMIN, STATE_APPROVER, MOSPI_REVIEWER, and MOSPI_APPROVER can bulk deactivate users
    if (
      ![
        UserRole.ADMIN,
        UserRole.STATE_APPROVER,
        UserRole.MOSPI_REVIEWER,
        UserRole.MOSPI_APPROVER,
      ].includes(userRole)
    ) {
      throw new ForbiddenException(
        "Only Admin, State Approvers and MoSPI roles can bulk deactivate users"
      );
    }

    const results = {
      successCount: 0,
      failedCount: 0,
      errors: [] as Array<{ userId: string; error: string }>,
    };

    for (const userId of userIds) {
      try {
        await this.deactivate(userId, userRole, userStateUt);
        results.successCount++;
      } catch (error) {
        results.failedCount++;
        results.errors.push({
          userId,
          error: error.message || "Unknown error occurred",
        });
      }
    }

    return results;
  }

  async createUser(
    createUserDto: CreateUserDto,
    userRole: UserRole,
    userStateUt: string
  ): Promise<{ user: Partial<User>; accessToken: string }> {
    const {
      email,
      password,
      firstName,
      lastName,
      contactNumber,
      role,
      stateUt,
      indicatorCodes,
    } = createUserDto;

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException("User with this email already exists");
    }

    // Only ADMIN and MoSPI roles can create users
    if (
      ![
        UserRole.ADMIN,
        UserRole.STATE_APPROVER,
        UserRole.MOSPI_REVIEWER,
        UserRole.MOSPI_APPROVER,
      ].includes(userRole)
    ) {
      throw new ForbiddenException(
        "Only Admin, State Approvers and MoSPI roles can create users"
      );
    }

    // State/UT approvers can only create users for their state
    if (userRole === UserRole.STATE_APPROVER && stateUt !== userStateUt) {
      throw new ForbiddenException("Cannot create user for different state/UT");
    }

    // Validate indicator codes for NODAL_OFFICER
    if (role === UserRole.NODAL_OFFICER) {
      if (!indicatorCodes || indicatorCodes.length === 0) {
        throw new ConflictException(
          "Indicator codes are required for NODAL_OFFICER role"
        );
      }

      // Check if all indicator codes exist
      const indicators = await this.indicatorRepository.find({
        where: { code: In(indicatorCodes), isActive: true },
      });

      if (indicators.length !== indicatorCodes.length) {
        const foundCodes = indicators.map((ind) => ind.code);
        const missingCodes = indicatorCodes.filter(
          (code) => !foundCodes.includes(code)
        );
        throw new ConflictException(
          `Invalid indicator codes: ${missingCodes.join(", ")}`
        );
      }
    }

    // Use transaction for user creation and indicator scope assignment
    return this.dataSource.transaction(async (manager) => {
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      const user = manager.create(User, {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        contactNumber,
        role,
        stateUt,
      });

      const savedUser = await manager.save(user);

      // Create indicator scope mappings for NODAL_OFFICER
      if (role === UserRole.NODAL_OFFICER && indicatorCodes) {
        const indicators = await manager.find(Indicator, {
          where: { code: In(indicatorCodes), isActive: true },
        });

        // --- NEW: check if any of these indicators are already assigned to another active user
        const indicatorIds = indicators.map((i) => i.id);
        if (indicatorIds.length > 0) {
          const existingScopes = await manager.find(UserIndicatorScope, {
            where: { indicatorId: In(indicatorIds) },
            relations: ["user"],
          });

          // Filter any scope where userId is not the user we're creating (should be all, since user is new)
          if (existingScopes.length > 0) {
            // Map to indicator codes for message
            const conflictedIndicatorIds = existingScopes.map(
              (s) => s.indicatorId
            );
            const conflictedIndicators = indicators.filter((i) =>
              conflictedIndicatorIds.includes(i.id)
            );
            const conflictCodes = conflictedIndicators.map((i) => i.code);
            // Throw conflict to rollback transaction
            throw new ConflictException(
              `Indicator(s) already assigned: ${conflictCodes.join(", ")}`
            );
          }
        }

        // If no conflicts, create scopes
        const userIndicatorScopes = indicators.map((indicator) =>
          manager.create(UserIndicatorScope, {
            userId: savedUser.id,
            indicatorId: indicator.id,
          })
        );

        await manager.save(UserIndicatorScope, userIndicatorScopes);
      }

      // Generate JWT token
      const payload = {
        sub: savedUser.id,
        email: savedUser.email,
        role: savedUser.role,
        stateUt: savedUser.stateUt,
      };

      const jwtService = require("@nestjs/jwt").JwtService;
      const jwt = new jwtService({ secret: process.env.JWT_SECRET });
      const accessToken = jwt.sign(payload);

      // Return user without password
      const { password: _, ...userWithoutPassword } = savedUser;

      return {
        user: userWithoutPassword,
        accessToken,
      };
    });
  }

  async getUsersByState(
    stateUt: string,
    userRole?: UserRole,
    userStateUt?: string,
    userId?: string
  ): Promise<any[]> {
    // Only ADMIN can access users from any state, others can only access their own state
    if (userRole && userRole !== UserRole.ADMIN && stateUt !== userStateUt) {
      throw new ForbiddenException("Access denied");
    }

    let query = this.userRepository
      .createQueryBuilder("user")
      .select([
        "user.id",
        "user.email",
        "user.firstName",
        "user.lastName",
        "user.contactNumber",
        "user.role",
        "user.stateUt",
        "user.isActive",
        "user.createdAt",
      ])
      .where("user.stateUt = :stateUt", { stateUt })
      .andWhere("user.isActive = :isActive", { isActive: true })
      .andWhere("user.role != :adminRole", { adminRole: UserRole.ADMIN });

    // Hide logged-in user from the list
    if (userId) {
      query = query.andWhere("user.id != :userId", { userId });
    }

    // Only STATE_APPROVER can see NODAL_OFFICER users, others cannot see them
    if (userRole !== UserRole.STATE_APPROVER) {
      query = query.andWhere("user.role != :nodalRole", {
        nodalRole: UserRole.NODAL_OFFICER,
      });
    } else {
      // STATE_APPROVER can only see NODAL_OFFICER users
      query = query.andWhere("user.role = :nodalRole", {
        nodalRole: UserRole.NODAL_OFFICER,
      });
    }

    const users = await query.getMany();

    // Get indicator codes for each user (simplified response)
    const usersWithIndicators = await Promise.all(
      users.map(async (user) => {
        const indicatorCodes = await this.getUserIndicatorCodes(user.id);
        return {
          ...user,
          assignedIndicators: indicatorCodes,
        };
      })
    );

    return usersWithIndicators;
  }

  async getUsersByRole(
    role: UserRole,
    stateUt?: string,
    userRole?: UserRole,
    userStateUt?: string,
    userId?: string
  ): Promise<any[]> {
    let query = this.userRepository
      .createQueryBuilder("user")
      .select([
        "user.id",
        "user.email",
        "user.firstName",
        "user.lastName",
        "user.contactNumber",
        "user.role",
        "user.stateUt",
        "user.isActive",
        "user.createdAt",
      ])
      .where("user.role = :role", { role })
      .andWhere("user.isActive = :isActive", { isActive: true })
      .andWhere("user.role != :adminRole", { adminRole: UserRole.ADMIN });

    // Hide logged-in user from the list
    if (userId) {
      query = query.andWhere("user.id != :userId", { userId });
    }

    // Only STATE_APPROVER can see NODAL_OFFICER users, others cannot see them
    if (userRole !== UserRole.STATE_APPROVER) {
      query = query.andWhere("user.role != :nodalRole", {
        nodalRole: UserRole.NODAL_OFFICER,
      });
    } else {
      // STATE_APPROVER can only see NODAL_OFFICER users
      query = query.andWhere("user.role = :nodalRole", {
        nodalRole: UserRole.NODAL_OFFICER,
      });
    }

    if (stateUt) {
      // Only ADMIN can access users from any state, others can only access their own state
      if (userRole && userRole !== UserRole.ADMIN && stateUt !== userStateUt) {
        throw new ForbiddenException("Access denied");
      }
      query.andWhere("user.stateUt = :stateUt", { stateUt });
    } else if (userRole && userRole !== UserRole.ADMIN) {
      // If no specific state requested and user is not ADMIN, restrict to their state
      query.andWhere("user.stateUt = :userStateUt", { userStateUt });
    }

    const users = await query.getMany();

    // Get indicators for each user
    const usersWithIndicators = await Promise.all(
      users.map(async (user) => {
        const indicators = await this.getUserIndicatorScopes(user.id);
        return {
          ...user,
          assignedIndicators: indicators,
        };
      })
    );

    return usersWithIndicators;
  }

  // Get user's assigned indicators from user_indicator_scope table
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

  // Get only indicator codes for a user (for simplified response)
  async getUserIndicatorCodes(userId: string): Promise<string[]> {
    const userIndicatorScopes = await this.userIndicatorScopeRepository
      .createQueryBuilder("scope")
      .leftJoinAndSelect("scope.indicator", "indicator")
      .where("scope.userId = :userId", { userId })
      .getMany();

    // Return codes as strings (e.g. "1.1", "2.3") — DO NOT convert to number
    return userIndicatorScopes.map((scope) => scope.indicator.code);
  }

  async updateUserIndicatorCodes(
    userId: string,
    indicatorCodes: (string | number)[]
  ): Promise<void> {
    // Convert numbers to strings for database lookup
    const stringCodes = (indicatorCodes || []).map((code) =>
      typeof code === "number" ? code.toString() : code
    );

    // If no indicator codes provided, just delete existing and return
    if (!stringCodes || stringCodes.length === 0) {
      await this.userIndicatorScopeRepository.delete({ userId });
      return;
    }

    // Get indicators by codes
    const indicators = await this.indicatorRepository.find({
      where: { code: In(stringCodes), isActive: true },
    });

    // Get indicatorIds to assign
    const indicatorIds = indicators.map((i) => i.id);

    // --- NEW: Find existing scopes for these indicators assigned to OTHER users
    if (indicatorIds.length > 0) {
      const existingScopes = await this.userIndicatorScopeRepository.find({
        where: { indicatorId: In(indicatorIds) },
      });

      const conflicts = existingScopes.filter((s) => s.userId !== userId);
      if (conflicts.length > 0) {
        // Map to codes
        const conflictIndicatorIds = conflicts.map((c) => c.indicatorId);
        const conflictIndicators = indicators.filter((i) =>
          conflictIndicatorIds.includes(i.id)
        );
        const conflictCodes = conflictIndicators.map((i) => i.code);
        throw new ConflictException(
          `Indicator(s) already assigned: ${conflictCodes.join(", ")}`
        );
      }
    }

    // No conflicts: delete existing scopes for this user and save new ones (atomic outside may be okay)
    await this.userIndicatorScopeRepository.delete({ userId });

    // Create new indicator scopes
    const indicatorScopes = indicators.map((indicator) => {
      const scope = new UserIndicatorScope();
      scope.userId = userId;
      scope.indicatorId = indicator.id;
      return scope;
    });

    // Save all new scopes
    if (indicatorScopes.length > 0) {
      await this.userIndicatorScopeRepository.save(indicatorScopes);
    }
  }

  // Get indicators by codes
  async getIndicatorsByCodes(codes: string[]) {
    return this.indicatorRepository.find({
      where: { code: In(codes), isActive: true },
    });
  }

  // Assign indicators to user
  async assignIndicatorsToUser(userId: string, indicatorIds: string[]) {
    // Remove existing assignments for this user
    await this.userIndicatorScopeRepository.delete({ userId });

    // Create new assignments
    const assignments = indicatorIds.map((indicatorId) => ({
      userId,
      indicatorId,
    }));

    await this.userIndicatorScopeRepository.save(assignments);

    return {
      message: "Indicators assigned successfully",
      assigned: indicatorIds,
    };
  }

  //Restrict for state assigned users

  async assignedStateByStateApprover(roleName: UserRole) {
    if (!roleName) {
      throw new Error("roleName is required");
    }
    const stateAssignedData = await this.userRepository.find({
      select: ["stateUt"],
      where: { isActive: true, role: roleName },
    });

    // Collect all state values (which may be comma-separated)
    const stateUtValues = stateAssignedData.map((user) => user.stateUt);

    // Split comma-separated values and flatten into a single array
    const allStates = stateUtValues.flatMap((stateString) =>
      stateString.split(",").map((state) => state.trim())
    );

    // Remove duplicates and filter out empty strings
    const uniqueStateUtValues = [...new Set(allStates)].filter(
      (state) => state.length > 0
    );

    return uniqueStateUtValues;
  }

  /**
   * TESTING ONLY: Delete all users by role
   * Deletes all users with the specified role along with their UserIndicatorScope records
   *
   * WARNING: This is a destructive operation for testing purposes only!
   *
   * @param role - The role of users to delete (NODAL_OFFICER, STATE_APPROVER, MOSPI_REVIEWER, MOSPI_APPROVER)
   * @returns Summary of deleted records
   */
  async deleteUsersByRole(role: UserRole): Promise<{
    success: boolean;
    message: string;
    deletedCount: number;
    deleted: {
      users: number;
      userIndicatorScopes: number;
      submissions: number;
      finalScores: number;
      auditLogs: number;
    };
  }> {
    this.logger.warn("=== DELETE USERS BY ROLE STARTED ===");
    this.logger.warn(`WARNING: This will delete all users with role: ${role}`);

    // Validate that the role is one of the allowed roles (not ADMIN)
    const allowedRoles = [
      UserRole.NODAL_OFFICER,
      UserRole.STATE_APPROVER,
      UserRole.MOSPI_REVIEWER,
      UserRole.MOSPI_APPROVER,
    ];

    if (!allowedRoles.includes(role)) {
      throw new BadRequestException(
        `Cannot delete users with role: ${role}. Allowed roles: ${allowedRoles.join(", ")}`
      );
    }

    return this.dataSource.transaction(async (manager) => {
      // Step 1: Find all users with the specified role
      const users = await manager.find(User, {
        where: { role },
        select: ["id", "email", "role"],
      });

      const userIds = users.map((u) => u.id);

      this.logger.log(`Found ${users.length} users with role: ${role}`);

      // Step 2: Find all submissions by these users
      let deletedSubmissions = 0;
      let deletedFinalScores = 0;
      const submissionIds: string[] = [];

      if (userIds.length > 0) {
        const submissions = await manager.find(Submission, {
          where: { submittedBy: In(userIds) },
          select: ["id", "submissionId", "submittedBy"],
        });

        submissionIds.push(...submissions.map((s) => s.id));
        deletedSubmissions = submissions.length;

        this.logger.log(`Found ${submissions.length} submissions to delete`);

        // Step 2.1: Delete FinalScore records related to these submissions
        // This must be done BEFORE deleting submissions due to foreign key constraint (NO ACTION)
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

        // Step 2.2: Delete submissions
        if (submissions.length > 0) {
          await manager.remove(Submission, submissions);
          this.logger.log(`Deleted ${submissions.length} submissions`);
        }
      }

      // Step 3: Delete AuditLog records for these users and their submissions
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

      // Step 4: Delete UserIndicatorScope records for these users
      let deletedScopes = 0;
      if (userIds.length > 0) {
        const userIndicatorScopes = await manager.find(UserIndicatorScope, {
          where: { userId: In(userIds) },
        });
        deletedScopes = userIndicatorScopes.length;
        if (userIndicatorScopes.length > 0) {
          await manager.remove(UserIndicatorScope, userIndicatorScopes);
          this.logger.log(
            `Deleted ${userIndicatorScopes.length} UserIndicatorScope records`
          );
        }
      }

      // Step 5: Delete users (this will cascade delete submissions if FK has CASCADE,
      // but we already deleted them explicitly to handle FinalScore properly)
      let deletedUsers = 0;
      if (users.length > 0) {
        await manager.remove(User, users);
        deletedUsers = users.length;
        this.logger.log(`Deleted ${users.length} users with role: ${role}`);
      }

      this.logger.warn("=== DELETE USERS BY ROLE COMPLETED ===");

      return {
        success: true,
        message: `Successfully deleted all users with role: ${role}`,
        deletedCount: deletedUsers,
        deleted: {
          users: deletedUsers,
          userIndicatorScopes: deletedScopes,
          submissions: deletedSubmissions,
          finalScores: deletedFinalScores,
          auditLogs: deletedAuditLogs,
        },
      };
    });
  }
}
