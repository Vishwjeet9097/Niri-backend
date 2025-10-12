import { NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ClsService } from 'nestjs-cls';
export declare class AuditMiddleware implements NestMiddleware {
    private clsService;
    constructor(clsService: ClsService);
    use(req: Request, res: Response, next: NextFunction): void;
}
