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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditSubscriber = void 0;
const typeorm_1 = require("typeorm");
const common_1 = require("@nestjs/common");
const nestjs_cls_1 = require("nestjs-cls");
const audit_log_entity_1 = require("../../entities/audit-log.entity");
let AuditSubscriber = class AuditSubscriber {
    constructor(dataSource, clsService) {
        this.dataSource = dataSource;
        this.clsService = clsService;
        dataSource.subscribers.push(this);
    }
    beforeInsert(event) {
        this.logAudit(event.entity, 'INSERT', null, event.entity);
    }
    beforeUpdate(event) {
        this.logAudit(event.entity, 'UPDATE', event.databaseEntity, event.entity);
    }
    beforeRemove(event) {
        this.logAudit(event.entity, 'DELETE', event.entity, null);
    }
    async logAudit(entity, action, oldValues, newValues) {
        try {
            const auditContext = this.clsService.get('auditContext');
            if (!auditContext) {
                return;
            }
            const auditLog = new audit_log_entity_1.AuditLog();
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
        }
        catch (error) {
            console.error('Audit logging failed:', error);
        }
    }
};
exports.AuditSubscriber = AuditSubscriber;
exports.AuditSubscriber = AuditSubscriber = __decorate([
    (0, common_1.Injectable)(),
    (0, typeorm_1.EventSubscriber)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource,
        nestjs_cls_1.ClsService])
], AuditSubscriber);
//# sourceMappingURL=audit.subscriber.js.map