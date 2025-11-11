import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Not, DataSource, In } from "typeorm";
import { User, UserRole } from "../../entities/user.entity";
import { Indicator } from "../../entities/indicator.entity";
import { UserIndicatorScope } from "../../entities/user-indicator-scope.entity";
import { UpdateUserDto, CreateUserDto } from "../auth/dto/auth.dto";
import * as bcrypt from "bcryptjs";

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Indicator)
    private indicatorRepository: Repository<Indicator>,
    @InjectRepository(UserIndicatorScope)
    private userIndicatorScopeRepository: Repository<UserIndicatorScope>,
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
      .andWhere("user.role != :adminRole", { adminRole: UserRole.ADMIN });

    // Hide logged-in user from the list
    if (userId) {
      query = query.andWhere("user.id != :userId", { userId });
    }

    // Only ADMIN can see all users, others can only see users from their state
    if (userRole !== UserRole.ADMIN  && userRole !== UserRole.MOSPI_APPROVER) {
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

    await this.userRepository.update(id, { isActive: false });
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
            const conflictedIndicatorIds = existingScopes.map((s) => s.indicatorId);
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
}
