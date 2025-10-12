import { 
  Controller, 
  Get, 
  Query, 
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuditService, AuditQueryDto } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { UserRole } from '../../entities/user.entity';

@Controller('audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.MOSPI_REVIEWER, UserRole.MOSPI_APPROVER)
  async findAll(@Query() queryDto: AuditQueryDto) {
    return this.auditService.findAll(queryDto);
  }

  @Get('entity/:entityType/:entityId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MOSPI_REVIEWER, UserRole.MOSPI_APPROVER)
  async getEntityAuditTrail(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.auditService.getEntityAuditTrail(entityType, entityId);
  }

  @Get('user/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MOSPI_REVIEWER, UserRole.MOSPI_APPROVER)
  async getUserAuditLogs(@Param('userId') userId: string) {
    return this.auditService.findByUser(userId);
  }

  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MOSPI_REVIEWER, UserRole.MOSPI_APPROVER)
  async getAuditStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.auditService.getAuditStats(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('my-activity')
  async getMyActivity(@Request() req) {
    return this.auditService.findByUser(req.user.id);
  }
}
