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
import { Submission, SubmissionStatus } from "../../entities/submission.entity";
import { FinalScore } from "../../entities/final-score.entity";
import { AuditLog } from "../../entities/audit-log.entity";
import { UpdateUserDto, CreateUserDto } from "../auth/dto/auth.dto";
import { MinistrySubmissionIndicator } from "../../ministry/entities/ministry-submission-indicator.entity";
import { IndicatorDetail } from "../../ministry/entities/indicator-detail.entity";
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
      UserRole.MINISTRY_APPROVER,
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
          "ministryId",
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
    @InjectRepository(MinistrySubmissionIndicator)
    private ministrySubmissionIndicatorRepository: Repository<MinistrySubmissionIndicator>,
    @InjectRepository(IndicatorDetail)
    private indicatorDetailRepository: Repository<IndicatorDetail>,
    private dataSource: DataSource
  ) {}

  async findAll(
    userRole: UserRole,
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
        "user.ministryId",
        "user.isActive",
        "user.createdAt",
        "user.ministryId",
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

    // Only STATE_APPROVER can see NODAL_OFFICER users, MINISTRY_APPROVER can see all except NODAL_OFFICER, others cannot see NODAL_OFFICER
    if (userRole === UserRole.STATE_APPROVER) {
       query = query.andWhere("user.role = :nodalRole", {
        nodalRole: UserRole.NODAL_OFFICER,
      });
    } else if (userRole === UserRole.MINISTRY_APPROVER) {
       query = query.andWhere("user.role = :nodalRole", {
        nodalRole: UserRole.NODAL_OFFICER,
      });
    } else {
      // Others cannot see NODAL_OFFICER users
      query = query.andWhere("user.role != :nodalRole", {
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

       // ✅ VALIDATION: Prevent editing STATE_APPROVER if they have NODAL_OFFICER users assigned
       if (user.role === UserRole.STATE_APPROVER) {
        const stateApproverStateUt = user.stateUt || userStateUt;
        
        if (stateApproverStateUt) {
          // Check if there are any active NODAL_OFFICER users assigned to this STATE_APPROVER's state
          const nodalOfficersCount = await this.userRepository.count({
            where: {
              role: UserRole.NODAL_OFFICER,
              stateUt: stateApproverStateUt,
              isActive: true,
            },
          });
  
          if (nodalOfficersCount > 0) {
            throw new BadRequestException(
              "Cannot edit STATE_APPROVER. This state approver has NODAL_OFFICER users assigned. Please remove or reassign all nodal officers before editing."
            );
          }
        }
      }
    // Admin, State Approver and MoSPI roles can change user roles
    if (
      updateUserDto.role &&
      ![
        UserRole.ADMIN,
        UserRole.STATE_APPROVER,
        UserRole.MOSPI_REVIEWER,
        UserRole.MOSPI_APPROVER,
        UserRole.MINISTRY_APPROVER,
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

    // Check if contact number already exists when updating (excluding current user)
    if (updateUserDto.contactNumber) {
      const normalizedContactNumber = updateUserDto.contactNumber.replace(
        /\s/g,
        ""
      ); // Remove spaces

      // Only check if any OTHER user (not the current user) has this contact number
      const existingUserWithContact = await this.userRepository.findOne({
        where: {
          contactNumber: normalizedContactNumber,
          id: Not(id), // Exclude current user from the search
        },
      });

      console.log("existingUserWithContact in update", existingUserWithContact);

      // Only throw error if another user (not the current user) has this contact number
      if (existingUserWithContact) {
        throw new ConflictException(
          "A user with this contact number already exists. Each user must have a unique contact number."
        );
      }
    }

    // Check if any state is already assigned to another MOSPI_REVIEWER when updating
    // Each state can have only one active MOSPI_REVIEWER, but a MOSPI_REVIEWER can have multiple states
    if (user.role === UserRole.MOSPI_REVIEWER && updateUserDto.stateUt) {
      // Parse comma-separated state names and normalize (trim and lowercase)
      const requestedStates = updateUserDto.stateUt
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

      if (requestedStates.length > 0) {
        // Get all active MOSPI_REVIEWERs (excluding the current user being updated)
        const existingReviewers = await this.userRepository.find({
          where: {
            role: UserRole.MOSPI_REVIEWER,
            isActive: true,
          },
        });

        // Check if any requested state is already assigned to another reviewer (case-insensitive)
        for (const requestedState of requestedStates) {
          for (const reviewer of existingReviewers) {
            // Skip the current user being updated
            if (reviewer.id === id) continue;

            if (reviewer.stateUt) {
              const reviewerStates = reviewer.stateUt
                .split(",")
                .map((s) => s.trim().toLowerCase())
                .filter(Boolean);
              if (reviewerStates.includes(requestedState)) {
                throw new ConflictException(
                  `State "${requestedState}" is already assigned to another MOSPI Reviewer. Each state can have only one active MOSPI Reviewer.`
                );
              }
            }
          }
        }
      }
    }

    // Handle indicator codes separately
    const { indicatorCodes, ...userUpdateData } = updateUserDto;

    // Filter out any invalid properties that don't exist in User entity
    const updateData = { ...userUpdateData };

    // Remove stateId if it exists, as User entity has stateUt
    if ("stateId" in updateData) {
      //  delete updateData.stateId;
    }

    // Normalize contact number if provided (remove spaces)
    if (updateData.contactNumber) {
      updateData.contactNumber = typeof updateData.contactNumber === "string" && updateData.contactNumber ? updateData.contactNumber.replace(/\s/g, "") : updateData.contactNumber;
    }

    // Normalize stateUt if provided (trim whitespace to prevent inconsistencies)
    if (updateData.stateUt) {
      updateData.stateUt =
        user.role === UserRole.MOSPI_REVIEWER
          ? updateData.stateUt
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
              .join(", ")
          : updateData.stateUt.trim();
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
    const userToDelete = await this.findOne(id, userRole, userStateUt);
  
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
  
    // Check if the user being deleted is a STATE_APPROVER
    // If yes, check if they have created any NODAL_OFFICER users
    if (userToDelete.role === UserRole.STATE_APPROVER) {
      const stateApproverStateUt = userToDelete.stateUt;
      
      // Check if there are any NODAL_OFFICER users in the same state
      const nodalOfficerCount = await this.userRepository.count({
        where: {
          role: UserRole.NODAL_OFFICER,
          stateUt: stateApproverStateUt,
          isActive: true,
        },
      });
  
      if (nodalOfficerCount > 0) {
        throw new BadRequestException(
          `Cannot delete State Approver. This State Approver has created ${nodalOfficerCount} Nodal Officer(s). Please delete all associated Nodal Officers first.`
        );
      }
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

    // Check if user already exists by email
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException("User with this email already exists");
    }

    // Check if contact number already exists (excluding current user if updating)
    if (contactNumber) {
      const normalizedContactNumber = typeof contactNumber === "string" && contactNumber ? contactNumber.replace(/\s/g, "") : contactNumber; // Remove spaces safely
      const existingUserWithContact = await this.userRepository.findOne({
        where: { contactNumber: normalizedContactNumber },
      });

      // In createUser, any match is a conflict (no user should exist with this contact)
      if (existingUserWithContact) {
        throw new ConflictException(
          "A user with this contact number already exists. Each user must have a unique contact number."
        );
      }
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

    // Early check if STATE_APPROVER already exists for this state
    // This provides fast feedback, but the definitive check is inside the transaction
    // Each state can have only one active STATE_APPROVER
    if (role === UserRole.STATE_APPROVER) {
      // Normalize the incoming stateUt for comparison (trim and lowercase)
      const normalizedStateUt = stateUt.trim().toLowerCase();

      // Get all STATE_APPROVERs to check against (case-insensitive comparison)
      const existingStateApprovers = await this.userRepository.find({
        where: {
          role: UserRole.STATE_APPROVER,
          isActive: true,
        },
      });

      console.log(
        `[STATE_APPROVER Validation] Checking for state: "${stateUt}" (normalized: "${normalizedStateUt}")`
      );
      console.log(
        `[STATE_APPROVER Validation] Found ${existingStateApprovers.length} existing STATE_APPROVERs`
      );
      existingStateApprovers.forEach((approver, index) => {
        const existingNormalized = approver.stateUt
          ? approver.stateUt.trim().toLowerCase()
          : "";
        console.log(
          `[STATE_APPROVER Validation] Existing ${index + 1}: stateUt="${approver.stateUt}" (normalized: "${existingNormalized}"), isActive=${approver.isActive}, email=${approver.email}`
        );
      });

      // Check if any existing STATE_APPROVER has the same normalized state
      const duplicate = existingStateApprovers.find((approver) => {
        if (!approver.stateUt) return false;
        const existingNormalized = approver.stateUt.trim().toLowerCase();
        return existingNormalized === normalizedStateUt;
      });

      if (duplicate) {
        console.log(
          `[STATE_APPROVER Validation] ❌ DUPLICATE FOUND! Existing user: ${duplicate.email}, stateUt: "${duplicate.stateUt}"`
        );
        throw new ConflictException(
          `A State Approver already exists for ${stateUt}. Each state can have only one active State Approver.`
        );
      }
      console.log(
        `[STATE_APPROVER Validation] ✅ No duplicate found, proceeding with creation`
      );
    }

    // Early check if any state is already assigned to another MOSPI_REVIEWER
    // Each state can have only one active MOSPI_REVIEWER, but a MOSPI_REVIEWER can have multiple states
    // This provides fast feedback, but the definitive check is inside the transaction
    if (role === UserRole.MOSPI_REVIEWER && stateUt) {
      // Parse comma-separated state names and normalize (trim and lowercase)
      const requestedStates = stateUt
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

      console.log(
        `[MOSPI_REVIEWER Validation] Checking for states: "${stateUt}" (normalized: [${requestedStates.join(", ")}])`
      );

      if (requestedStates.length > 0) {
        // Get all active MOSPI_REVIEWERs
        const existingReviewers = await this.userRepository.find({
          where: {
            role: UserRole.MOSPI_REVIEWER,
            isActive: true,
          },
        });

        console.log(
          `[MOSPI_REVIEWER Validation] Found ${existingReviewers.length} existing MOSPI_REVIEWERs`
        );
        existingReviewers.forEach((reviewer, index) => {
          const reviewerStates = reviewer.stateUt
            ? reviewer.stateUt
                .split(",")
                .map((s) => s.trim().toLowerCase())
                .filter(Boolean)
            : [];
          console.log(
            `[MOSPI_REVIEWER Validation] Existing ${index + 1}: stateUt="${reviewer.stateUt}" (normalized: [${reviewerStates.join(", ")}]), isActive=${reviewer.isActive}, email=${reviewer.email}`
          );
        });

        // Check if any requested state is already assigned to another reviewer (case-insensitive)
        for (const requestedState of requestedStates) {
          for (const reviewer of existingReviewers) {
            if (reviewer.stateUt) {
              const reviewerStates = reviewer.stateUt
                .split(",")
                .map((s) => s.trim().toLowerCase())
                .filter(Boolean);
              if (reviewerStates.includes(requestedState)) {
                console.log(
                  `[MOSPI_REVIEWER Validation] ❌ DUPLICATE FOUND! State "${requestedState}" already assigned to reviewer: ${reviewer.email}`
                );
                throw new ConflictException(
                  `State "${requestedState}" is already assigned to another MOSPI Reviewer. Each state can have only one active MOSPI Reviewer.`
                );
              }
            }
          }
        }
        console.log(
          `[MOSPI_REVIEWER Validation] ✅ No duplicate states found, proceeding with creation`
        );
      }
    }

    // Validate indicator codes for NODAL_OFFICER (if provided)
    // Indicator assignment is optional - if no indicators are assigned, user will see all indicators
    if (
      role === UserRole.NODAL_OFFICER &&
      indicatorCodes &&
      indicatorCodes.length > 0
    ) {
      // Check if all indicator codes exist (only validate if indicators are provided)
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
      // Check if contact number already exists INSIDE transaction
      // This prevents race conditions when multiple requests come simultaneously
      if (contactNumber) {
        const normalizedContactNumber = typeof contactNumber === "string" && contactNumber ? contactNumber.replace(/\s/g, "") : contactNumber; // Remove spaces safely
        const existingUserWithContact = await manager.findOne(User, {
          where: { contactNumber: normalizedContactNumber },
        });

        if (existingUserWithContact) {
          throw new ConflictException(
            "A user with this contact number already exists. Each user must have a unique contact number."
          );
        }
      }

      // Check if STATE_APPROVER already exists for this state INSIDE transaction
      // This prevents race conditions when multiple requests come simultaneously
      // Each state can have only one active STATE_APPROVER
      if (role === UserRole.STATE_APPROVER) {
        // Normalize the incoming stateUt for comparison (trim and lowercase)
        const normalizedStateUt = stateUt.trim().toLowerCase();

        // Get all STATE_APPROVERs to check against (case-insensitive comparison)
        const existingStateApprovers = await manager.find(User, {
          where: {
            role: UserRole.STATE_APPROVER,
            isActive: true,
          },
        });

        console.log(
          `[STATE_APPROVER Transaction Check] Checking for state: "${stateUt}" (normalized: "${normalizedStateUt}")`
        );
        console.log(
          `[STATE_APPROVER Transaction Check] Found ${existingStateApprovers.length} existing STATE_APPROVERs in transaction`
        );
        existingStateApprovers.forEach((approver, index) => {
          const existingNormalized = approver.stateUt
            ? approver.stateUt.trim().toLowerCase()
            : "";
          console.log(
            `[STATE_APPROVER Transaction Check] Existing ${index + 1}: stateUt="${approver.stateUt}" (normalized: "${existingNormalized}"), isActive=${approver.isActive}, email=${approver.email}`
          );
        });

        // Check if any existing STATE_APPROVER has the same normalized state
        const duplicate = existingStateApprovers.find((approver) => {
          if (!approver.stateUt) return false;
          const existingNormalized = approver.stateUt.trim().toLowerCase();
          return existingNormalized === normalizedStateUt;
        });

        if (duplicate) {
          console.log(
            `[STATE_APPROVER Transaction Check] ❌ DUPLICATE FOUND IN TRANSACTION! Existing user: ${duplicate.email}, stateUt: "${duplicate.stateUt}"`
          );
          throw new ConflictException(
            `A State Approver already exists for ${stateUt}. Each state can have only one active State Approver.`
          );
        }

        console.log(
          `[STATE_APPROVER Transaction Check] ✅ No duplicate found in transaction, proceeding with creation`
        );
      }

      // Check if any state is already assigned to another MOSPI_REVIEWER INSIDE transaction
      // This prevents race conditions when multiple requests come simultaneously
      // Each state can have only one active MOSPI_REVIEWER, but a MOSPI_REVIEWER can have multiple states
      if (role === UserRole.MOSPI_REVIEWER && stateUt) {
        // Parse comma-separated state names and normalize (trim and lowercase)
        const requestedStates = stateUt
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);

        console.log(
          `[MOSPI_REVIEWER Transaction Check] Checking for states: "${stateUt}" (normalized: [${requestedStates.join(", ")}])`
        );

        if (requestedStates.length > 0) {
          // Get all active MOSPI_REVIEWERs
          const existingReviewers = await manager.find(User, {
            where: {
              role: UserRole.MOSPI_REVIEWER,
              isActive: true,
            },
          });

          console.log(
            `[MOSPI_REVIEWER Transaction Check] Found ${existingReviewers.length} existing MOSPI_REVIEWERs in transaction`
          );
          existingReviewers.forEach((reviewer, index) => {
            const reviewerStates = reviewer.stateUt
              ? reviewer.stateUt
                  .split(",")
                  .map((s) => s.trim().toLowerCase())
                  .filter(Boolean)
              : [];
            console.log(
              `[MOSPI_REVIEWER Transaction Check] Existing ${index + 1}: stateUt="${reviewer.stateUt}" (normalized: [${reviewerStates.join(", ")}]), isActive=${reviewer.isActive}, email=${reviewer.email}`
            );
          });

          // Check if any requested state is already assigned to another reviewer (case-insensitive)
          for (const requestedState of requestedStates) {
            for (const reviewer of existingReviewers) {
              if (reviewer.stateUt) {
                const reviewerStates = reviewer.stateUt
                  .split(",")
                  .map((s) => s.trim().toLowerCase())
                  .filter(Boolean);
                if (reviewerStates.includes(requestedState)) {
                  console.log(
                    `[MOSPI_REVIEWER Transaction Check] ❌ DUPLICATE FOUND IN TRANSACTION! State "${requestedState}" already assigned to reviewer: ${reviewer.email}`
                  );
                  throw new ConflictException(
                    `State "${requestedState}" is already assigned to another MOSPI Reviewer. Each state can have only one active MOSPI Reviewer.`
                  );
                }
              }
            }
          }

          console.log(
            `[MOSPI_REVIEWER Transaction Check] ✅ No duplicate states found in transaction, proceeding with creation`
          );
        }
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Normalize contact number (remove spaces)
      const normalizedContactNumber = contactNumber
        ? contactNumber.replace(/\s/g, "")
        : contactNumber;

      // Normalize stateUt (trim whitespace to prevent inconsistencies)
      // For MOSPI_REVIEWER, normalize each state in comma-separated list
      const normalizedStateUt =
        role === UserRole.MOSPI_REVIEWER && stateUt
          ? stateUt
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
              .join(", ")
          : stateUt
            ? stateUt.trim()
            : stateUt;

      // Create user
      const user = manager.create(User, {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        contactNumber: normalizedContactNumber,
        role,
        stateUt: normalizedStateUt,
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
  // If user has ministryId, also get indicators from ministry_submission_indicator table
  async getUserIndicatorScopes(userId: string) {
    // Get user to check if they have a ministry and role
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'ministryId', 'role'],
    });

    // Get indicators from user_indicator_scope table
    const userIndicatorScopes = await this.userIndicatorScopeRepository
      .createQueryBuilder("scope")
      .leftJoinAndSelect("scope.indicator", "indicator")
      .where("scope.userId = :userId", { userId })
      .getMany();

    const indicatorsFromScope = userIndicatorScopes.map((scope) => ({
      code: scope.indicator.code,
      name: scope.indicator.name,
    }));

    // Get indicators from ministry_submission_indicator table
    // For MINISTRY_APPROVER: check where ministryUser = userId
    // For NODAL_OFFICER: check where assignedTo = userId
    let ministrySubmissionIndicators: MinistrySubmissionIndicator[] = [];
    
    if (user?.ministryId) {
      if (user.role === UserRole.MINISTRY_APPROVER) {
        // For ministry approver, get indicators where they are the ministry user
        ministrySubmissionIndicators = await this.ministrySubmissionIndicatorRepository.find({
          where: { ministryUser: userId },
        });
      } else if (user.role === UserRole.NODAL_OFFICER) {
        // For nodal officer, get indicators where they are assigned (assignedTo = userId)
        ministrySubmissionIndicators = await this.ministrySubmissionIndicatorRepository.find({
          where: { assignedTo: userId },
        });
      }
    }

    if (ministrySubmissionIndicators.length > 0) {
      const indicatorIds = ministrySubmissionIndicators.map((msi) => msi.indicatorId);
      const indicatorDetails = await this.indicatorDetailRepository.find({
        where: { id: In(indicatorIds) },
      });

      const indicatorDetailMap = new Map(indicatorDetails.map((ind) => [ind.id, ind]));

      // Add indicators from ministry_submission_indicator table
      const indicatorsFromMinistry = ministrySubmissionIndicators.map((msi) => {
        const indicatorDetail = indicatorDetailMap.get(msi.indicatorId);
        return indicatorDetail ? {
          code: indicatorDetail.sNo || indicatorDetail.id,
          name: indicatorDetail.name,
          status: msi.status,
        } : null;
      }).filter((ind) => ind !== null);

      // Combine both sources, avoiding duplicates based on code
      const combinedIndicators = [...indicatorsFromScope];
      const existingCodes = new Set(indicatorsFromScope.map((ind) => ind.code));
      
      indicatorsFromMinistry.forEach((ind) => {
        if (ind && !existingCodes.has(ind.code)) {
          combinedIndicators.push(ind);
        }
      });

      return combinedIndicators;
    }

    return indicatorsFromScope;
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

    this.logger.log(
      `Updating indicator codes for user ${userId}: [${stringCodes.join(", ")}]`
    );

    // Use transaction to ensure atomicity - all or nothing
    return await this.dataSource.transaction(async (manager) => {
      // Get the user's stateUt to filter conflicts by state
      // Indicators should only be unique within the same state, not globally
      const targetUser = await manager.findOne(User, {
        where: { id: userId },
        select: ["id", "stateUt", "role"],
      });

      if (!targetUser) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      const userStateUt = targetUser.stateUt;

      this.logger.log(
        `[updateUserIndicatorCodes] User ${userId} - State: ${userStateUt || "N/A"}, Role: ${targetUser.role}`
      );

      // If no indicator codes provided, just delete existing and return
      if (!stringCodes || stringCodes.length === 0) {
        const deletedCount = await manager.delete(UserIndicatorScope, {
          userId,
        });
        this.logger.log(
          `Removed all indicators for user ${userId} (${deletedCount.affected || 0} scopes deleted)`
        );
        return;
      }

      // Get indicators by codes
      const indicators = await manager.find(Indicator, {
        where: { code: In(stringCodes), isActive: true },
      });

      // Validate that all requested indicators exist
      if (indicators.length !== stringCodes.length) {
        const foundCodes = indicators.map((i) => i.code);
        const missingCodes = stringCodes.filter(
          (code) => !foundCodes.includes(code)
        );

        this.logger.warn(
          `Some indicators not found or inactive for user ${userId}: [${missingCodes.join(", ")}]`
        );

        throw new BadRequestException(
          `Some indicators not found or inactive: ${missingCodes.join(", ")}`
        );
      }

      // Get indicatorIds to assign
      const indicatorIds = indicators.map((i) => i.id);

      // Get current user's existing indicator assignments using explicit query
      // This ensures we get accurate data even in transaction scenarios
      const currentUserScopes = await manager
        .createQueryBuilder(UserIndicatorScope, "scope")
        .leftJoinAndSelect("scope.indicator", "indicator")
        .where("scope.userId = :userId", { userId })
        .getMany();

      const currentUserIndicatorIds = currentUserScopes.map(
        (s) => s.indicatorId
      );
      const currentUserIndicatorCodes = currentUserScopes
        .map((s) => s.indicator?.code)
        .filter(Boolean);

      this.logger.log(
        `[updateUserIndicatorCodes] User ${userId} - Found ${currentUserScopes.length} existing scopes`
      );
      this.logger.log(
        `[updateUserIndicatorCodes] User ${userId} - Current indicator IDs: [${currentUserIndicatorIds.join(", ")}]`
      );
      this.logger.log(
        `[updateUserIndicatorCodes] User ${userId} - Current indicator codes: [${currentUserIndicatorCodes.join(", ")}]`
      );
      this.logger.log(
        `[updateUserIndicatorCodes] User ${userId} - Requested indicator codes: [${stringCodes.join(", ")}]`
      );

      // Find which indicators are NEW (not already assigned to this user)
      const newIndicatorIds = indicatorIds.filter(
        (id) => !currentUserIndicatorIds.includes(id)
      );

      const newIndicatorCodes = indicators
        .filter((i) => newIndicatorIds.includes(i.id))
        .map((i) => i.code);

      this.logger.log(
        `[updateUserIndicatorCodes] User ${userId} - NEW indicator IDs: [${newIndicatorIds.join(", ")}]`
      );
      this.logger.log(
        `[updateUserIndicatorCodes] User ${userId} - NEW indicator codes: [${newIndicatorCodes.join(", ")}]`
      );

      // Find which indicators are being REMOVED
      // Need to get all indicators (not just the new ones) to find removed ones
      const allIndicatorsForRemoved = await manager.find(Indicator, {
        where: { id: In(currentUserIndicatorIds), isActive: true },
      });

      const removedIndicatorIds = currentUserIndicatorIds.filter(
        (id) => !indicatorIds.includes(id)
      );
      const removedIndicators = allIndicatorsForRemoved.filter((i) =>
        removedIndicatorIds.includes(i.id)
      );
      const removedCodes = removedIndicators.map((i) => i.code);

      if (removedCodes.length > 0) {
        this.logger.log(
          `Removing indicators from user ${userId}: [${removedCodes.join(", ")}]`
        );

        // Check if any indicators being removed have active submissions
        const blockingStatuses = [
          SubmissionStatus.SUBMITTED_TO_STATE,
          SubmissionStatus.SUBMITTED_TO_MOSPI_REVIEWER,
          SubmissionStatus.SUBMITTED_TO_MOSPI_APPROVER,
          SubmissionStatus.APPROVED,
        ];

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
          section4_2: "4.1",
          section4_3: "4.2",
          section4_4: "4.3",
          section4_5: "4.4",
          section4_6: "4.5",
        };

        // Check submissions in the state for these indicators
        const submissions = await manager
          .createQueryBuilder(Submission, "submission")
          .innerJoin("submission.user", "user")
          .where("user.stateUt = :userStateUt", {
            userStateUt: userStateUt || "",
          })
          .andWhere("user.isActive = :isActive", { isActive: true })
          .andWhere("submission.status IN (:...statuses)", {
            statuses: blockingStatuses,
          })
          .getMany();

        const submittedIndicatorsInState = new Set<string>();

        submissions.forEach((submission) => {
          const formData = submission.formData || {};
          const categories = [
            "infraFinancing",
            "infraDevelopment",
            "pppDevelopment",
            "infraEnablers",
          ];

          categories.forEach((category) => {
            const categoryData = formData[category] || {};
            Object.keys(categoryData).forEach((sectionKey) => {
              if (sectionKey.startsWith("section")) {
                const sectionData = categoryData[sectionKey];
                if (
                  sectionData &&
                  typeof sectionData === "object" &&
                  blockingStatuses.includes(sectionData.status)
                ) {
                  const indicatorCode = sectionToIndicatorMap[sectionKey];
                  if (indicatorCode) {
                    submittedIndicatorsInState.add(indicatorCode);
                  }
                }
              }
            });
          });
        });

        // Check if any removed indicators are in the submitted list
        const cannotRemove = removedCodes.filter((code) =>
          submittedIndicatorsInState.has(code)
        );

        if (cannotRemove.length > 0) {
          this.logger.warn(
            `[updateUserIndicatorCodes] User ${userId} - Cannot remove submitted indicators: [${cannotRemove.join(", ")}]`
          );
          throw new ConflictException(
            `Cannot remove indicators that have been submitted: ${cannotRemove.join(", ")}. These indicators cannot be reassigned to prevent duplicate submissions.`
          );
        }
      }

      // Rule: Each indicator can only be assigned to ONE user WITHIN THE SAME STATE
      // Check for conflicts with OTHER users in the SAME STATE for NEW indicators only
      // This allows users to keep their existing indicators (no conflict check needed)
      // But prevents assigning NEW indicators that are already assigned to other users in the same state
      if (newIndicatorIds.length > 0) {
        this.logger.log(
          `[updateUserIndicatorCodes] User ${userId} - Checking conflicts for NEW indicators: [${newIndicatorCodes.join(", ")}] in state: ${userStateUt || "N/A"}`
        );

        // Use explicit query to exclude current user AND filter by same state
        // Only check for conflicts with users in the SAME state
        const conflictingScopes = await manager
          .createQueryBuilder(UserIndicatorScope, "scope")
          .innerJoin("scope.user", "user")
          .where("scope.indicatorId IN (:...indicatorIds)", {
            indicatorIds: newIndicatorIds,
          })
          .andWhere("scope.userId != :userId", { userId })
          .andWhere("user.stateUt = :userStateUt", {
            userStateUt: userStateUt || "",
          })
          .andWhere("user.isActive = :isActive", { isActive: true })
          .getMany();

        this.logger.log(
          `[updateUserIndicatorCodes] User ${userId} - Found ${conflictingScopes.length} conflicting scopes for NEW indicators in state ${userStateUt || "N/A"}`
        );

        if (conflictingScopes.length > 0) {
          // Map to codes for error message
          const conflictIndicatorIds = conflictingScopes.map(
            (c) => c.indicatorId
          );
          const conflictIndicators = indicators.filter((i) =>
            conflictIndicatorIds.includes(i.id)
          );
          const conflictCodes = conflictIndicators.map((i) => i.code);

          // Get which users have these indicators for better debugging
          const conflictUserIds = Array.from(
            new Set(conflictingScopes.map((c) => c.userId))
          );

          this.logger.warn(
            `[updateUserIndicatorCodes] User ${userId} - CONFLICT DETECTED: indicators [${conflictCodes.join(", ")}] already assigned to users [${conflictUserIds.join(", ")}]`
          );
          this.logger.warn(
            `[updateUserIndicatorCodes] User ${userId} - Conflict details: ${conflictingScopes.map((s) => `indicatorId=${s.indicatorId}, userId=${s.userId}`).join("; ")}`
          );

          throw new ConflictException(
            `Indicator(s) already assigned to another user. Each indicator can only be assigned to one user: ${conflictCodes.join(", ")}`
          );
        } else {
          this.logger.log(
            `[updateUserIndicatorCodes] User ${userId} - No conflicts found for NEW indicators: [${newIndicatorCodes.join(", ")}]`
          );
        }
      } else {
        this.logger.log(
          `[updateUserIndicatorCodes] User ${userId} - No NEW indicators to check (all indicators already assigned to this user)`
        );
      }

      // No conflicts: delete existing scopes for this user and save new ones atomically
      const deleteResult = await manager.delete(UserIndicatorScope, { userId });
      this.logger.log(
        `Deleted ${deleteResult.affected || 0} existing indicator scopes for user ${userId}`
      );

      // Create new indicator scopes
      const indicatorScopes = indicators.map((indicator) => {
        const scope = manager.create(UserIndicatorScope, {
          userId,
          indicatorId: indicator.id,
        });
        return scope;
      });

      // Save all new scopes
      if (indicatorScopes.length > 0) {
        await manager.save(UserIndicatorScope, indicatorScopes);
        const newCodes = indicators.map((i) => i.code);
        this.logger.log(
          `Successfully assigned indicators to user ${userId}: [${newCodes.join(", ")}]`
        );
      } else {
        this.logger.log(`No indicators to assign for user ${userId}`);
      }
    });
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

  async checkEmailAvailability(
    email: string,
    excludeUserId?: string
  ): Promise<boolean> {
    const whereCondition: any = { email };

    if (excludeUserId) {
      whereCondition.id = Not(excludeUserId);
    }

    const existingUser = await this.userRepository.findOne({
      where: whereCondition,
    });

    return !existingUser; // Return true if available (no user found)
  }

  /**
   * Admin-only: Change a user's password without requiring current password.
   * Used when admin resets a user's password from user management.
   */
  async changePasswordByAdmin(
    userId: string,
    newPassword: string,
    adminRole: UserRole
  ): Promise<void> {
    if (adminRole !== UserRole.ADMIN) {
      throw new ForbiddenException("Only Admin can change user passwords");
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ["id", "email", "role"],
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Hide ADMIN users from all roles (including ADMIN itself)
    if (user.role === UserRole.ADMIN) {
      throw new NotFoundException("User not found");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await this.userRepository.update(userId, { password: hashedPassword });
  }

  async checkContactAvailability(
    contactNumber: string,
    excludeUserId?: string
  ): Promise<boolean> {
    // Normalize contact number (remove spaces)
    const normalizedContact = contactNumber.replace(/\s/g, "");

    // If excludeUserId is provided, first check if this contact already belongs to that user
    console.log("excludeUserId in checkContactAvailability", excludeUserId);
    if (excludeUserId) {
      const currentUser = await this.userRepository.findOne({
        where: { id: excludeUserId, contactNumber: normalizedContact },
      });

      // If the contact number already belongs to this user, it's available (return true)
      if (currentUser) {
        return true;
      }
    }

    // Check if any other user has this contact number
    const whereCondition: any = { contactNumber: normalizedContact };

    if (excludeUserId) {
      whereCondition.id = Not(excludeUserId);
    }

    const existingUser = await this.userRepository.findOne({
      where: whereCondition,
    });

    // Return true if available (no other user found with this contact)
    return !existingUser;
  }
}
