import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
export interface JwtPayload {
    sub: string;
    email: string;
    role: string;
    stateUt: string;
    iat?: number;
    exp?: number;
}
declare const JwtStrategy_base: new (...args: any[]) => Strategy;
export declare class JwtStrategy extends JwtStrategy_base {
    private configService;
    private authService;
    constructor(configService: ConfigService, authService: AuthService);
    validate(payload: JwtPayload): Promise<{
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: import("../../../entities/user.entity").UserRole;
        stateUt: string;
        isActive: boolean;
    }>;
}
export {};
