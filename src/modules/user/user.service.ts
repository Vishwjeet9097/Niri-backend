import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User, UserRole } from "../../entities/user.entity";
import { UpdateUserDto, CreateUserDto } from "../auth/dto/auth.dto";
import * as bcrypt from "bcryptjs";
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Not } from "typeorm";
import { User, UserRole } from "../../entities/user.entity";
import { UpdateUserDto, CreateUserDto } from "../auth/dto/auth.dto";
import * as bcrypt from "bcryptjs";

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>
  ) {}

  async findAll(
    userRole: UserRole,
    userStateUt: string,
    userId?: string
  ): Promise<User[]> {
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
      .where("user.isActive = :isActive", { isActive: true });
      .where("user.isActive = :isActive", { isActive: true })
      .andWhere("user.role != :adminRole", { adminRole: UserRole.ADMIN });

    // Hide ADMIN users from all roles (including ADMIN itself)

    // Hide logged-in user from the list
    if (userId) {
      query = query.andWhere("user.id != :userId", { userId });
    }

    // Only ADMIN can see all users, others can only see users from their state
    if (userRole !== UserRole.ADMIN) {
      query = query.andWhere("user.stateUt = :stateUt", {
        stateUt: userStateUt,
      });
    }

    // STATE_APPROVER can only see NODAL_OFFICER users
    if (userRole === UserRole.STATE_APPROVER) {
      query = query.andWhere("user.stateUt = :stateUt", {
        stateUt: userStateUt,
      });
      query = query.andWhere("user.role = :nodalRole", {
        nodalRole: UserRole.NODAL_OFFICER,
      });
    }

    return query.getMany();
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

    // State/UT approvers can only access users from their state
    if (userRole === UserRole.STATE_APPROVER && user.stateUt !== userStateUt) {
      throw new ForbiddenException("Access denied");
    // Hide ADMIN users from all roles (including ADMIN itself)
    if (user.role === UserRole.ADMIN) {
      throw new NotFoundException("User not found");
    }

    // Only ADMIN can access users from any state, others can only access users from their state
    if (userRole !== UserRole.ADMIN && user.stateUt !== userStateUt) {
      throw new ForbiddenException("Access denied");
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
        UserRole.STATE_APPROVER,
        UserRole.MOSPI_REVIEWER,
        UserRole.MOSPI_APPROVER,
      ].includes(userRole)
      ![
        UserRole.ADMIN,
        UserRole.STATE_APPROVER,
        UserRole.MOSPI_REVIEWER,
        UserRole.MOSPI_APPROVER,
      ].includes(userRole)
    ) {
      throw new ForbiddenException(
        "Only State Approver and MoSPI roles can change user roles"
      );
      throw new ForbiddenException(
        "Only Admin, State Approver and MoSPI roles can change user roles"
      );
    }

    // State/UT approvers cannot change state_ut
    if (updateUserDto.stateUt && userRole === UserRole.STATE_APPROVER) {
      throw new ForbiddenException("Cannot change state/UT");
    }

    // Filter out any invalid properties that don't exist in User entity
    const updateData = { ...updateUserDto };
    delete updateData.stateId; // Remove stateId if it exists, as User entity has stateUt
    
    await this.userRepository.update(id, updateData);
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
        UserRole.STATE_APPROVER,
        UserRole.MOSPI_REVIEWER,
        UserRole.MOSPI_APPROVER,
      ].includes(userRole)
      ![
        UserRole.ADMIN,
        UserRole.STATE_APPROVER,
        UserRole.MOSPI_REVIEWER,
        UserRole.MOSPI_APPROVER,
      ].includes(userRole)
    ) {
      throw new ForbiddenException(
        "Only State Approver and MoSPI roles can deactivate users"
      );
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
        UserRole.STATE_APPROVER,
        UserRole.MOSPI_REVIEWER,
        UserRole.MOSPI_APPROVER,
      ].includes(userRole)
      ![
        UserRole.ADMIN,
        UserRole.STATE_APPROVER,
        UserRole.MOSPI_REVIEWER,
        UserRole.MOSPI_APPROVER,
      ].includes(userRole)
    ) {
      throw new ForbiddenException(
        "Only State Approvers and MoSPI roles can bulk deactivate users"
        "Only Admin, State Approvers and MoSPI roles can bulk deactivate users"
      );
    }

    const result = {
      successCount: 0,
      failedCount: 0,
      errors: [] as Array<{ userId: string; error: string }>,
    };

    for (const userId of userIds) {
      try {
        // Check if user exists and has proper access
        const user = await this.findOne(userId, userRole, userStateUt);

        // Deactivate the user
        await this.userRepository.update(userId, { isActive: false });
        result.successCount++;
      } catch (error) {
        result.failedCount++;
        result.errors.push({
          userId,
          error: error.message || "Unknown error occurred",
        });
      }
    }

    return result;
  }

  async getUsersByState(stateUt: string): Promise<User[]> {
    return this.userRepository.find({
      where: { stateUt, isActive: true },
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
  }

  async getUsersByRole(role: UserRole, stateUt?: string): Promise<User[]> {
    const query = this.userRepository
      .createQueryBuilder("user")
  async getUsersByState(
    stateUt: string,
    userRole?: UserRole,
    userStateUt?: string,
    userId?: string
  ): Promise<User[]> {
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

    // STATE_APPROVER can only see NODAL_OFFICER users
    if (userRole === UserRole.STATE_APPROVER) {
      query = query.andWhere("user.role = :nodalRole", {
        nodalRole: UserRole.NODAL_OFFICER,
      });
    }

    return query.getMany();
  }

  async getUsersByRole(
    role: UserRole,
    stateUt?: string,
    userRole?: UserRole,
    userStateUt?: string,
    userId?: string
  ): Promise<User[]> {
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
      .andWhere("user.isActive = :isActive", { isActive: true });
      .where("user.role = :role", { role })
      .andWhere("user.isActive = :isActive", { isActive: true })
      .andWhere("user.role != :adminRole", { adminRole: UserRole.ADMIN });

    // Hide logged-in user from the list
    if (userId) {
      query = query.andWhere("user.id != :userId", { userId });
    }

    // STATE_APPROVER can only see NODAL_OFFICER users
    if (userRole === UserRole.STATE_APPROVER) {
      query = query.andWhere("user.role = :nodalRole", {
        nodalRole: UserRole.NODAL_OFFICER,
      });
    }

    if (stateUt) {
      query.andWhere("user.stateUt = :stateUt", { stateUt });
      // Only ADMIN can access users from any state, others can only access their own state
      if (userRole && userRole !== UserRole.ADMIN && stateUt !== userStateUt) {
        throw new ForbiddenException("Access denied");
      }
      query.andWhere("user.stateUt = :stateUt", { stateUt });
    } else if (userRole && userRole !== UserRole.ADMIN) {
      // If no specific state requested and user is not ADMIN, restrict to their state
      query.andWhere("user.stateUt = :userStateUt", { userStateUt });
    }

    return query.getMany();
  }

  /**
   * Create a new user with state restrictions
   * State Approvers can only create users for their state
   * MoSPI roles can create users for any state
   */
  async createUser(
    createUserDto: CreateUserDto,
    approverRole: UserRole,
    approverState: string
  ): Promise<{ user: Partial<User>; message: string }> {
    const {
      email,
      password,
      firstName,
      lastName,
      contactNumber,
      role,
      stateUt,
    } = createUserDto;

    // Debug logging
    console.log("🔍 Debug - User Creation:");
    console.log("Approver Role:", approverRole);
    console.log("Approver State:", approverState);
    console.log("Requested State:", stateUt);
    console.log("Role Check:", approverRole === UserRole.STATE_APPROVER);
    console.log("Contact Number:", contactNumber);
    console.log("Full DTO:", createUserDto);

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException("User with this email already exists");
    }

    // State restriction for State Approvers
    if (approverRole === UserRole.STATE_APPROVER) {
      console.log("🚨 State Approver restriction check:");
      console.log("Requested state:", stateUt);
      console.log("Approver state:", approverState);
      console.log("States match:", stateUt === approverState);

      if (stateUt !== approverState) {
        throw new ForbiddenException(
          `You can only create users for ${approverState}. Cannot create user for ${stateUt}`
        );
      }
    }

    // Admin and MoSPI roles can create users for any state (no restriction)

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = this.userRepository.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      contactNumber,
      role,
      stateUt,
    });

    const savedUser = await this.userRepository.save(user);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = savedUser;

    return {
      user: userWithoutPassword,
      message: `User created successfully for ${stateUt}`,
    };
  }
}
