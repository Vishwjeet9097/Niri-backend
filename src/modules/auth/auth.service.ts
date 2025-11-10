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

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user

    const normalizedStateUt =
  stateUt == null || // null or undefined
  stateUt === "" ||
  (typeof stateUt === "object" && Object.keys(stateUt).length === 0)
    ? ""
    : stateUt;

    console.log(`Creating user with stateUt: '${normalizedStateUt}'`);
     
    const user = this.userRepository.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      contactNumber,
      role,
      stateUt: normalizedStateUt
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
