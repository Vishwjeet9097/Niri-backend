import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../../entities/user.entity';
import { UpdateUserDto } from '../auth/dto/auth.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findAll(userRole: UserRole, userStateUt: string): Promise<User[]> {
    let query = this.userRepository
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.email',
        'user.firstName',
        'user.lastName',
        'user.role',
        'user.stateUt',
        'user.isActive',
        'user.createdAt',
      ])
      .where('user.isActive = :isActive', { isActive: true });

    // State/UT approvers can only see users from their state
    if (userRole === UserRole.STATE_APPROVER) {
      query = query.andWhere('user.stateUt = :stateUt', { stateUt: userStateUt });
    }

    return query.getMany();
  }

  async findOne(id: string, userRole: UserRole, userStateUt: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      select: [
        'id',
        'email',
        'firstName',
        'lastName',
        'contactNumber',
        'role',
        'stateUt',
        'isActive',
        'createdAt',
      ],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // State/UT approvers can only access users from their state
    if (userRole === UserRole.STATE_APPROVER && user.stateUt !== userStateUt) {
      throw new ForbiddenException('Access denied');
    }

    return user;
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    userRole: UserRole,
    userStateUt: string,
  ): Promise<User> {
    const user = await this.findOne(id, userRole, userStateUt);

    // State Approver and MoSPI roles can change user roles
    if (
      updateUserDto.role &&
      ![UserRole.STATE_APPROVER, UserRole.MOSPI_REVIEWER, UserRole.MOSPI_APPROVER].includes(
        userRole,
      )
    ) {
      throw new ForbiddenException('Only State Approver and MoSPI roles can change user roles');
    }

    // State/UT approvers cannot change state_ut
    if (updateUserDto.stateUt && userRole === UserRole.STATE_APPROVER) {
      throw new ForbiddenException('Cannot change state/UT');
    }

    await this.userRepository.update(id, updateUserDto);
    return this.findOne(id, userRole, userStateUt);
  }

  async deactivate(id: string, userRole: UserRole, userStateUt: string): Promise<void> {
    await this.findOne(id, userRole, userStateUt);

    // State Approver and MoSPI roles can deactivate users
    if (
      ![UserRole.STATE_APPROVER, UserRole.MOSPI_REVIEWER, UserRole.MOSPI_APPROVER].includes(
        userRole,
      )
    ) {
      throw new ForbiddenException('Only State Approver and MoSPI roles can deactivate users');
    }

    await this.userRepository.update(id, { isActive: false });
  }

  async bulkDeactivate(
    userIds: string[],
    userRole: UserRole,
    userStateUt: string,
  ): Promise<{
    successCount: number;
    failedCount: number;
    errors: Array<{ userId: string; error: string }>;
  }> {
    // Only STATE_APPROVER, MOSPI_REVIEWER, and MOSPI_APPROVER can bulk deactivate users
    if (
      ![UserRole.STATE_APPROVER, UserRole.MOSPI_REVIEWER, UserRole.MOSPI_APPROVER].includes(
        userRole,
      )
    ) {
      throw new ForbiddenException(
        'Only State Approvers and MoSPI roles can bulk deactivate users',
      );
    }

    const result = {
      successCount: 0,
      failedCount: 0,
      errors: [] as Array<{ userId: string; error: string }>,
    };

    for (const userId of userIds) {
      try {
        // Check if user exists and has proper access
        const user = await this.findOne(userId, userRole, userStateUt);

        // Deactivate the user
        await this.userRepository.update(userId, { isActive: false });
        result.successCount++;
      } catch (error) {
        result.failedCount++;
        result.errors.push({
          userId,
          error: error.message || 'Unknown error occurred',
        });
      }
    }

    return result;
  }

  async getUsersByState(stateUt: string): Promise<User[]> {
    return this.userRepository.find({
      where: { stateUt, isActive: true },
      select: ['id', 'email', 'firstName', 'lastName', 'role', 'stateUt', 'isActive', 'createdAt'],
    });
  }

  async getUsersByRole(role: UserRole, stateUt?: string): Promise<User[]> {
    const query = this.userRepository
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.email',
        'user.firstName',
        'user.lastName',
        'user.role',
        'user.stateUt',
        'user.isActive',
        'user.createdAt',
      ])
      .where('user.role = :role', { role })
      .andWhere('user.isActive = :isActive', { isActive: true });

    if (stateUt) {
      query.andWhere('user.stateUt = :stateUt', { stateUt });
    }

    return query.getMany();
  }
}
