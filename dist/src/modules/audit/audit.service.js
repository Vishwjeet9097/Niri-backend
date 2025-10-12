"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const audit_log_entity_1 = require("../../entities/audit-log.entity");
let AuditService = class AuditService {
    constructor(auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }
    async findAll(queryDto) {
        const { entityType, entityId, userId, userRole, action, startDate, endDate, page = '1', limit = '10', } = queryDto;
        const query = this.auditLogRepository.createQueryBuilder('auditLog');
        if (entityType) {
            query.andWhere('auditLog.entityType = :entityType', { entityType });
        }
        if (entityId) {
            query.andWhere('auditLog.entityId = :entityId', { entityId });
        }
        if (userId) {
            query.andWhere('auditLog.userId = :userId', { userId });
        }
        if (userRole) {
            query.andWhere('auditLog.userRole = :userRole', { userRole });
        }
        if (action) {
            query.andWhere('auditLog.action = :action', { action });
        }
        if (startDate && endDate) {
            query.andWhere('auditLog.createdAt BETWEEN :startDate AND :endDate', {
                startDate: new Date(startDate),
                endDate: new Date(endDate),
            });
        }
        const skip = (parseInt(page) - 1) * parseInt(limit);
        query.skip(skip).take(parseInt(limit));
        query.orderBy('auditLog.createdAt', 'DESC');
        const [logs, total] = await query.getManyAndCount();
        return { logs, total };
    }
    async findByEntity(entityType, entityId) {
        return this.auditLogRepository.find({
            where: { entityType, entityId },
            order: { createdAt: 'DESC' },
        });
    }
    async findByUser(userId, limit = 50) {
        return this.auditLogRepository.find({
            where: { userId },
            order: { createdAt: 'DESC' },
            take: limit,
        });
    }
    async getAuditStats(startDate, endDate) {
        const query = this.auditLogRepository.createQueryBuilder('auditLog');
        if (startDate && endDate) {
            query.andWhere('auditLog.createdAt BETWEEN :startDate AND :endDate', {
                startDate,
                endDate,
            });
        }
        const stats = await query
            .select('auditLog.action', 'action')
            .addSelect('COUNT(*)', 'count')
            .groupBy('auditLog.action')
            .getRawMany();
        return stats.reduce((acc, stat) => {
            acc[stat.action] = parseInt(stat.count);
            return acc;
        }, {});
    }
    async getEntityAuditTrail(entityType, entityId) {
        const logs = await this.findByEntity(entityType, entityId);
        return logs.map(log => ({
            id: log.id,
            action: log.action,
            userRole: log.userRole,
            timestamp: log.createdAt,
            changes: {
                oldValues: log.oldValues,
                newValues: log.newValues,
            },
            metadata: {
                ipAddress: log.ipAddress,
                userAgent: log.userAgent,
            },
        }));
    }
};
exports.AuditService = AuditService;
exports.AuditService = AuditService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(audit_log_entity_1.AuditLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], AuditService);
//# sourceMappingURL=audit.service.js.map