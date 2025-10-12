import { UserRole } from '../../../entities/user.entity';
export declare class CreateUserDto {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    stateUt: string;
}
export declare class LoginDto {
    email: string;
    password: string;
}
export declare class UpdateUserDto {
    firstName?: string;
    lastName?: string;
    contactNumber?: string;
    role?: UserRole;
    stateUt?: string;
    password?: string;
}
export declare class ChangePasswordDto {
    currentPassword: string;
    newPassword: string;
}
