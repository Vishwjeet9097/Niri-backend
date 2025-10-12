import { UserRole } from './user.entity';
export declare class AuditLog {
    id: string;
    entityType: string;
    entityId: string;
    userId: string;
    userRole: UserRole;
    action: string;
    oldValues: Record<string, any>;
    newValues: Record<string, any>;
    ipAddress: string;
    userAgent: string;
    createdAt: Date;
}
