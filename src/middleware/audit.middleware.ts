import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class AuditMiddleware implements NestMiddleware {
  constructor(private clsService: ClsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Extract user information from JWT token if available
    const user = (req as any).user;
    
    if (user) {
      this.clsService.set('auditContext', {
        userId: user.id,
        userRole: user.role,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
      });
    }

    next();
  }
}
