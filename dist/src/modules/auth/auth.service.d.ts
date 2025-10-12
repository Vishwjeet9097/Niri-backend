import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { CreateUserDto, LoginDto } from './dto/auth.dto';
export declare class AuthService {
    private userRepository;
    private jwtService;
    constructor(userRepository: Repository<User>, jwtService: JwtService);
    register(createUserDto: CreateUserDto): Promise<{
        user: Partial<User>;
        accessToken: string;
    }>;
    login(loginDto: LoginDto): Promise<{
        user: Partial<User>;
        accessToken: string;
    }>;
    validateUserById(userId: string): Promise<User | null>;
    getUserProfile(userId: string): Promise<Partial<User>>;
    changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;
}
