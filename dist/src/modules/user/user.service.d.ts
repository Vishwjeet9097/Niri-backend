import { Repository } from 'typeorm';
import { User, UserRole } from '../../entities/user.entity';
import { UpdateUserDto, CreateUserDto } from '../auth/dto/auth.dto';
export declare class UserService {
    private userRepository;
    constructor(userRepository: Repository<User>);
    findAll(userRole: UserRole, userStateUt: string): Promise<User[]>;
    findOne(id: string, userRole: UserRole, userStateUt: string): Promise<User>;
    update(id: string, updateUserDto: UpdateUserDto, userRole: UserRole, userStateUt: string): Promise<User>;
    deactivate(id: string, userRole: UserRole, userStateUt: string): Promise<void>;
    bulkDeactivate(userIds: string[], userRole: UserRole, userStateUt: string): Promise<{
        successCount: number;
        failedCount: number;
        errors: Array<{
            userId: string;
            error: string;
        }>;
    }>;
    getUsersByState(stateUt: string): Promise<User[]>;
    getUsersByRole(role: UserRole, stateUt?: string): Promise<User[]>;
    createUser(createUserDto: CreateUserDto, approverRole: UserRole, approverState: string): Promise<{
        user: Partial<User>;
        message: string;
    }>;
}
