import { Repository } from 'typeorm';
import { AuditLog } from '../../entities/audit-log.entity';
import { UserRole } from '../../entities/user.entity';
export interface AuditQueryDto {
    entityType?: string;
    entityId?: string;
    userId?: string;
    userRole?: UserRole;
    action?: string;
    startDate?: string;
    endDate?: string;
    page?: string;
    limit?: string;
}
export declare class AuditService {
    private auditLogRepository;
    constructor(auditLogRepository: Repository<AuditLog>);
    findAll(queryDto: AuditQueryDto): Promise<{
        logs: AuditLog[];
        total: number;
    }>;
    findByEntity(entityType: string, entityId: string): Promise<AuditLog[]>;
    findByUser(userId: string, limit?: number): Promise<AuditLog[]>;
    getAuditStats(startDate?: Date, endDate?: Date): Promise<any>;
    getEntityAuditTrail(entityType: string, entityId: string): Promise<any[]>;
}
