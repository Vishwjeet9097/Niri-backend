import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
  RemoveEvent,
} from 'typeorm';
import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { AuditLog } from '../../entities/audit-log.entity';
import { UserRole } from '../../entities/user.entity';

@Injectable()
@EventSubscriber()
export class AuditSubscriber implements EntitySubscriberInterface {
  constructor(
    private dataSource: DataSource,
    private clsService: ClsService,
  ) {
    dataSource.subscribers.push(this);
  }

  beforeInsert(event: InsertEvent<any>) {
    this.logAudit(event.entity, 'INSERT', null, event.entity);
  }

  beforeUpdate(event: UpdateEvent<any>) {
    this.logAudit(event.entity, 'UPDATE', event.databaseEntity, event.entity);
  }

  beforeRemove(event: RemoveEvent<any>) {
    this.logAudit(event.entity, 'DELETE', event.entity, null);
  }

  private async logAudit(entity: any, action: string, oldValues: any, newValues: any) {
    try {
      const auditContext = this.clsService.get('auditContext');

      if (!auditContext) {
        return; // No audit context available
      }

      const auditLog = new AuditLog();
      auditLog.entityType = entity.constructor.name;
      auditLog.entityId = entity.id;
      auditLog.userId = auditContext.userId;
      auditLog.userRole = auditContext.userRole;
      auditLog.action = action;
      auditLog.oldValues = oldValues;
      auditLog.newValues = newValues;
      auditLog.ipAddress = auditContext.ipAddress;
      auditLog.userAgent = auditContext.userAgent;

      await this.dataSource.manager.save(auditLog);
    } catch (error) {
      console.error('Audit logging failed:', error);
    }
  }
}
