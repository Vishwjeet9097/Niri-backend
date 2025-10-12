import { UserService } from './user.service';
import { UpdateUserDto } from '../auth/dto/auth.dto';
import { UserRole } from '../../entities/user.entity';
export declare class UserController {
    private readonly userService;
    constructor(userService: UserService);
    findAll(req: any): Promise<import("../../entities/user.entity").User[]>;
    getUsersByState(stateUt: string): Promise<import("../../entities/user.entity").User[]>;
    getUsersByRole(role: UserRole, stateUt?: string): Promise<import("../../entities/user.entity").User[]>;
    findOne(id: string, req: any): Promise<import("../../entities/user.entity").User>;
    update(id: string, updateUserDto: UpdateUserDto, req: any): Promise<import("../../entities/user.entity").User>;
    deactivate(id: string, req: any): Promise<{
        message: string;
    }>;
    bulkDeactivate(bulkDeleteDto: {
        userIds: string[];
    }, req: any): Promise<{
        message: string;
        details: {
            successCount: number;
            failedCount: number;
            errors: Array<{
                userId: string;
                error: string;
            }>;
        };
    }>;
}
