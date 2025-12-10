import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, In } from "typeorm";
import * as bcrypt from "bcryptjs";
import { User, UserRole } from "../../entities/user.entity";
import { CreateUserDto, LoginDto } from "./dto/auth.dto";
import { DatabaseHealthService } from "../../common/services/database-health.service";
import { Indicator } from "../../entities/indicator.entity";
import { UserIndicatorScope } from "../../entities/user-indicator-scope.entity";

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Indicator)
    private indicatorRepository: Repository<Indicator>,
    @InjectRepository(UserIndicatorScope)
    private userIndicatorScopeRepository: Repository<UserIndicatorScope>,
    private jwtService: JwtService,
    private databaseHealthService: DatabaseHealthService,
    private dataSource: DataSource
  ) {}

  async register(
    createUserDto: CreateUserDto
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

    // Check if contact number already exists
    if (contactNumber) {
      const normalizedContactNumber = contactNumber.replace(/\s/g, ""); // Remove spaces
      const existingUserWithContact = await this.userRepository.findOne({
        where: { contactNumber: normalizedContactNumber },
      });

      if (existingUserWithContact) {
        throw new ConflictException(
          "A user with this contact number already exists. Each user must have a unique contact number."
        );
      }
    }

    // Check if STATE_APPROVER already exists for this state
    // Each state can have only one active STATE_APPROVER
    if (role === UserRole.STATE_APPROVER && stateUt) {
      // Normalize the incoming stateUt for comparison (trim and lowercase)
      const normalizedStateUt = stateUt.trim().toLowerCase();
      
      // Get all STATE_APPROVERs to check against (case-insensitive comparison)
      const existingStateApprovers = await this.userRepository.find({
        where: {
          role: UserRole.STATE_APPROVER,
          isActive: true,
        },
      });

      console.log(`[AUTH Register - STATE_APPROVER Validation] Checking for state: "${stateUt}" (normalized: "${normalizedStateUt}")`);
      console.log(`[AUTH Register - STATE_APPROVER Validation] Found ${existingStateApprovers.length} existing STATE_APPROVERs`);
      existingStateApprovers.forEach((approver, index) => {
        const existingNormalized = approver.stateUt ? approver.stateUt.trim().toLowerCase() : '';
        console.log(`[AUTH Register - STATE_APPROVER Validation] Existing ${index + 1}: stateUt="${approver.stateUt}" (normalized: "${existingNormalized}"), isActive=${approver.isActive}, email=${approver.email}`);
      });

      // Check if any existing STATE_APPROVER has the same normalized state
      const duplicate = existingStateApprovers.find(approver => {
        if (!approver.stateUt) return false;
        const existingNormalized = approver.stateUt.trim().toLowerCase();
        return existingNormalized === normalizedStateUt;
      });

      if (duplicate) {
        console.log(`[AUTH Register - STATE_APPROVER Validation] ❌ DUPLICATE FOUND! Existing user: ${duplicate.email}, stateUt: "${duplicate.stateUt}"`);
        throw new ConflictException(
          `A State Approver already exists for ${stateUt}. Each state can have only one active State Approver.`
        );
      }
      console.log(`[AUTH Register - STATE_APPROVER Validation] ✅ No duplicate found, proceeding with registration`);
    }

    // Check if any state is already assigned to another MOSPI_REVIEWER
    // Each state can have only one active MOSPI_REVIEWER, but a MOSPI_REVIEWER can have multiple states
    if (role === UserRole.MOSPI_REVIEWER && stateUt) {
      // Parse comma-separated state names and normalize (trim and lowercase)
      const requestedStates = stateUt.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      
      console.log(`[AUTH Register - MOSPI_REVIEWER Validation] Checking for states: "${stateUt}" (normalized: [${requestedStates.join(', ')}])`);
      
      if (requestedStates.length > 0) {
        // Get all active MOSPI_REVIEWERs
        const existingReviewers = await this.userRepository.find({
          where: {
            role: UserRole.MOSPI_REVIEWER,
            isActive: true,
          },
        });

        console.log(`[AUTH Register - MOSPI_REVIEWER Validation] Found ${existingReviewers.length} existing MOSPI_REVIEWERs`);
        existingReviewers.forEach((reviewer, index) => {
          const reviewerStates = reviewer.stateUt ? reviewer.stateUt.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];
          console.log(`[AUTH Register - MOSPI_REVIEWER Validation] Existing ${index + 1}: stateUt="${reviewer.stateUt}" (normalized: [${reviewerStates.join(', ')}]), isActive=${reviewer.isActive}, email=${reviewer.email}`);
        });

        // Check if any requested state is already assigned to another reviewer (case-insensitive)
        for (const requestedState of requestedStates) {
          for (const reviewer of existingReviewers) {
            if (reviewer.stateUt) {
              const reviewerStates = reviewer.stateUt.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
              if (reviewerStates.includes(requestedState)) {
                console.log(`[AUTH Register - MOSPI_REVIEWER Validation] ❌ DUPLICATE FOUND! State "${requestedState}" already assigned to reviewer: ${reviewer.email}`);
                throw new ConflictException(
                  `State "${requestedState}" is already assigned to another MOSPI Reviewer. Each state can have only one active MOSPI Reviewer.`
                );
              }
            }
          }
        }
        console.log(`[AUTH Register - MOSPI_REVIEWER Validation] ✅ No duplicate states found, proceeding with registration`);
      }
    }

    // Validate indicator codes for NODAL_OFFICER (if provided)
    // Indicator assignment is optional - if no indicators are assigned, user will see all indicators
    if (role === UserRole.NODAL_OFFICER && indicatorCodes && indicatorCodes.length > 0) {
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

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Normalize contact number (remove spaces)
    const normalizedContactNumber = contactNumber ? contactNumber.replace(/\s/g, "") : contactNumber;

    // Normalize stateUt (trim whitespace to prevent inconsistencies)
    // For MOSPI_REVIEWER, normalize each state in comma-separated list
    let normalizedStateUt = "";
    if (stateUt != null && stateUt !== "" && !(typeof stateUt === "object" && Object.keys(stateUt).length === 0)) {
      normalizedStateUt = role === UserRole.MOSPI_REVIEWER
        ? stateUt.split(',').map(s => s.trim()).filter(Boolean).join(', ')
        : stateUt.trim();
    }

    // Create user
    const user = this.userRepository.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      contactNumber: normalizedContactNumber,
      role,
      stateUt: normalizedStateUt,
      isActive: true,
    });

    const savedUser = await this.userRepository.save(user);

    console.log(`User created with role: ${role}`);
    console.log(`Indicator codes:`, indicatorCodes);

    // Create indicator scope mappings for NODAL_OFFICER
    if (role === UserRole.NODAL_OFFICER && indicatorCodes) {
      try {
        console.log(
          `Creating indicator scope for user ${savedUser.id} with codes: ${indicatorCodes.join(", ")}`
        );

        const indicators = await this.indicatorRepository.find({
          where: { code: In(indicatorCodes), isActive: true },
        });

        console.log(
          `Found ${indicators.length} indicators:`,
          indicators.map((i) => i.code)
        );

        if (indicators.length === 0) {
          throw new Error("No indicators found for given codes");
        }

        const userIndicatorScopes = indicators.map((indicator) =>
          this.userIndicatorScopeRepository.create({
            userId: savedUser.id,
            indicatorId: indicator.id,
          })
        );

        console.log(
          `Creating ${userIndicatorScopes.length} user indicator scope records`
        );
        const savedScopes =
          await this.userIndicatorScopeRepository.save(userIndicatorScopes);
        console.log(
          "User indicator scope records saved successfully:",
          savedScopes.length
        );
      } catch (error) {
        console.error("Error creating indicator scope:", error);
        throw error;
      }
    }

    // Generate JWT token
    const payload = {
      sub: savedUser.id,
      email: savedUser.email,
      role: savedUser.role,
      stateUt: savedUser.stateUt,
    };

    const accessToken = this.jwtService.sign(payload);

    // Return user without password
    const { password: _, ...userWithoutPassword } = savedUser;

    return {
      user: userWithoutPassword,
      accessToken,
    };
  }

  async login(
    loginDto: LoginDto
  ): Promise<{ user: Partial<User>; accessToken: string }> {
    const { email, password } = loginDto;

    console.log(`Attempting login for email: ${loginDto}`);

    // Check database health before login
    const dbHealth = await this.databaseHealthService.checkDatabaseHealth();

    if (!dbHealth.isConnected) {
      throw new ServiceUnavailableException("Database is not available");
    }

    if (!dbHealth.hasUsersTable) {
      throw new ServiceUnavailableException("Users table not found");
    }

    if (dbHealth.userCount === 0) {
      throw new ServiceUnavailableException("No users found in database");
    }

    // Find user by email
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException("Account is deactivated");
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // Generate JWT token
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      stateUt: user.stateUt,
    };

    const accessToken = this.jwtService.sign(payload);

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      accessToken,
    };
  }

  async validateUserById(userId: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { id: userId, isActive: true },
    });
    return user;
  }

  async getUserProfile(userId: string): Promise<Partial<User>> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    // Return user without password
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException("Current password is incorrect");
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await this.userRepository.update(userId, { password: hashedNewPassword });
  }
}
