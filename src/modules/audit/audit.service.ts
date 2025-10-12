import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
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

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  async findAll(queryDto: AuditQueryDto): Promise<{ logs: AuditLog[]; total: number }> {
    const {
      entityType,
      entityId,
      userId,
      userRole,
      action,
      startDate,
      endDate,
      page = '1',
      limit = '10',
    } = queryDto;

    const query = this.auditLogRepository.createQueryBuilder('auditLog');

    // Apply filters
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

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    query.skip(skip).take(parseInt(limit));

    // Order by creation date
    query.orderBy('auditLog.createdAt', 'DESC');

    const [logs, total] = await query.getManyAndCount();

    return { logs, total };
  }

  async findByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { entityType, entityId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByUser(userId: string, limit: number = 50): Promise<AuditLog[]> {
    return this.auditLogRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getAuditStats(startDate?: Date, endDate?: Date): Promise<any> {
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

  async getEntityAuditTrail(entityType: string, entityId: string): Promise<any[]> {
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
}
