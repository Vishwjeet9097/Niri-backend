import { DataSource, EntitySubscriberInterface, InsertEvent, UpdateEvent, RemoveEvent } from 'typeorm';
import { ClsService } from 'nestjs-cls';
export declare class AuditSubscriber implements EntitySubscriberInterface {
    private dataSource;
    private clsService;
    constructor(dataSource: DataSource, clsService: ClsService);
    beforeInsert(event: InsertEvent<any>): void;
    beforeUpdate(event: UpdateEvent<any>): void;
    beforeRemove(event: RemoveEvent<any>): void;
    private logAudit;
}
