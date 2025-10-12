import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from '../auth/dto/auth.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { UserRole } from '../../entities/user.entity';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async findAll(@Request() req) {
    return this.userService.findAll(req.user.role, req.user.stateUt);
  }

  @Get('by-state/:stateUt')
  async getUsersByState(@Param('stateUt') stateUt: string) {
    return this.userService.getUsersByState(stateUt);
  }

  @Get('by-role/:role')
  async getUsersByRole(@Param('role') role: UserRole, @Query('stateUt') stateUt?: string) {
    return this.userService.getUsersByRole(role, stateUt);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req) {
    return this.userService.findOne(id, req.user.role, req.user.stateUt);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STATE_APPROVER, UserRole.MOSPI_REVIEWER, UserRole.MOSPI_APPROVER)
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto, @Request() req) {
    return this.userService.update(id, updateUserDto, req.user.role, req.user.stateUt);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STATE_APPROVER, UserRole.MOSPI_REVIEWER, UserRole.MOSPI_APPROVER)
  async deactivate(@Param('id') id: string, @Request() req) {
    await this.userService.deactivate(id, req.user.role, req.user.stateUt);
    return { message: 'User deactivated successfully' };
  }

  @Delete('bulk/delete')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STATE_APPROVER, UserRole.MOSPI_REVIEWER, UserRole.MOSPI_APPROVER)
  async bulkDeactivate(@Body() bulkDeleteDto: { userIds: string[] }, @Request() req) {
    const result = await this.userService.bulkDeactivate(
      bulkDeleteDto.userIds,
      req.user.role,
      req.user.stateUt,
    );
    return {
      message: `Successfully deactivated ${result.successCount} users`,
      details: result,
    };
  }
}
