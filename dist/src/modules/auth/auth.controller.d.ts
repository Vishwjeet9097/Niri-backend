import { AuthService } from './auth.service';
import { CreateUserDto, LoginDto, ChangePasswordDto } from './dto/auth.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    register(createUserDto: CreateUserDto): Promise<{
        user: Partial<import("../../entities/user.entity").User>;
        accessToken: string;
    }>;
    login(loginDto: LoginDto): Promise<{
        user: Partial<import("../../entities/user.entity").User>;
        accessToken: string;
    }>;
    getProfile(req: any): Promise<Partial<import("../../entities/user.entity").User>>;
    changePassword(req: any, changePasswordDto: ChangePasswordDto): Promise<{
        message: string;
    }>;
    testAdmin(req: any): Promise<{
        message: string;
        user: any;
    }>;
}
