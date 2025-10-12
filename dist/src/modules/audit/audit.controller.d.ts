import { AuditService, AuditQueryDto } from './audit.service';
export declare class AuditController {
    private readonly auditService;
    constructor(auditService: AuditService);
    findAll(queryDto: AuditQueryDto): Promise<{
        logs: import("../../entities/audit-log.entity").AuditLog[];
        total: number;
    }>;
    getEntityAuditTrail(entityType: string, entityId: string): Promise<any[]>;
    getUserAuditLogs(userId: string): Promise<import("../../entities/audit-log.entity").AuditLog[]>;
    getAuditStats(startDate?: string, endDate?: string): Promise<any>;
    getMyActivity(req: any): Promise<import("../../entities/audit-log.entity").AuditLog[]>;
}
