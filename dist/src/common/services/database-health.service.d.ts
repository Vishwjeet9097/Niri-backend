import { Repository } from "typeorm";
import { User } from "../../entities/user.entity";
export declare class DatabaseHealthService {
    private userRepository;
    constructor(userRepository: Repository<User>);
    checkDatabaseHealth(): Promise<{
        isConnected: boolean;
        hasUsersTable: boolean;
        userCount: number;
        error?: string;
    }>;
    checkUsersTableExists(): Promise<boolean>;
}
