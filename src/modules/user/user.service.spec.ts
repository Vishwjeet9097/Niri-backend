import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserService } from './user.service';
import { User, UserRole } from '../../entities/user.entity';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('UserService', () => {
  let service: UserService;
  let repository: Repository<User>;

  const mockRepository = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    repository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('bulkDeactivate', () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: UserRole.NODAL_OFFICER,
      stateUt: 'Maharashtra',
      isActive: true,
      createdAt: new Date(),
    };

    it('should successfully deactivate multiple users', async () => {
      const userIds = ['user-1', 'user-2', 'user-3'];

      // Mock findOne to return valid users
      mockRepository.findOne.mockResolvedValue(mockUser);
      mockRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.bulkDeactivate(userIds, UserRole.MOSPI_REVIEWER, 'Maharashtra');

      expect(result.successCount).toBe(3);
      expect(result.failedCount).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(mockRepository.update).toHaveBeenCalledTimes(3);
    });

    it('should handle partial failures gracefully', async () => {
      const userIds = ['user-1', 'user-2', 'user-3'];

      // Mock first user success, second user not found, third user success
      mockRepository.findOne
        .mockResolvedValueOnce(mockUser) // user-1 success
        .mockRejectedValueOnce(new NotFoundException('User not found')) // user-2 failure
        .mockResolvedValueOnce(mockUser); // user-3 success

      mockRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.bulkDeactivate(userIds, UserRole.MOSPI_REVIEWER, 'Maharashtra');

      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].userId).toBe('user-2');
      expect(result.errors[0].error).toBe('User not found');
    });

    it('should throw ForbiddenException for NODAL_OFFICER role', async () => {
      const userIds = ['user-1'];

      await expect(
        service.bulkDeactivate(userIds, UserRole.NODAL_OFFICER, 'Maharashtra'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow STATE_APPROVER to bulk deactivate', async () => {
      const userIds = ['user-1'];
      mockRepository.findOne.mockResolvedValue(mockUser);
      mockRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.bulkDeactivate(userIds, UserRole.STATE_APPROVER, 'Maharashtra');

      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(0);
    });

    it('should allow MoSPI_REVIEWER to bulk deactivate', async () => {
      const userIds = ['user-1'];
      mockRepository.findOne.mockResolvedValue(mockUser);
      mockRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.bulkDeactivate(userIds, UserRole.MOSPI_REVIEWER, 'Maharashtra');

      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(0);
    });

    it('should allow MoSPI_APPROVER to bulk deactivate', async () => {
      const userIds = ['user-1'];
      mockRepository.findOne.mockResolvedValue(mockUser);
      mockRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.bulkDeactivate(userIds, UserRole.MOSPI_APPROVER, 'Maharashtra');

      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(0);
    });

    it('should handle empty userIds array', async () => {
      const userIds: string[] = [];

      const result = await service.bulkDeactivate(userIds, UserRole.MOSPI_REVIEWER, 'Maharashtra');

      expect(result.successCount).toBe(0);
      expect(result.failedCount).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });
});
