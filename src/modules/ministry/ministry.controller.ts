import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { MinistryService } from './ministry.service';
import { Ministry } from '../../entities/ministry.entity';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { UserRole } from '../../entities/user.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';


@Controller('ministries')
@UseGuards(JwtAuthGuard)
export class MinistryController {
  constructor(private readonly ministryService: MinistryService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MINISTRY_APPROVER)
  async getAll(): Promise<Omit<Ministry, 'createdAt' | 'updatedAt'>[]> {
    const ministries = await this.ministryService.findAll();
    return ministries.map(({ createdAt, updatedAt, ...rest }) => rest);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MINISTRY_APPROVER)
  async getOne(@Param('id') id: string): Promise<Omit<Ministry, 'createdAt' | 'updatedAt'>> {
    const { createdAt, updatedAt, ...rest } = await this.ministryService.findOne(id);
    return rest;
  }
}
