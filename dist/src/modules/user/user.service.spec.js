"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const typeorm_1 = require("@nestjs/typeorm");
const user_service_1 = require("./user.service");
const user_entity_1 = require("../../entities/user.entity");
const common_1 = require("@nestjs/common");
describe('UserService', () => {
    let service;
    let repository;
    const mockRepository = {
        createQueryBuilder: jest.fn(),
        findOne: jest.fn(),
        find: jest.fn(),
        update: jest.fn(),
    };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                user_service_1.UserService,
                {
                    provide: (0, typeorm_1.getRepositoryToken)(user_entity_1.User),
                    useValue: mockRepository,
                },
            ],
        }).compile();
        service = module.get(user_service_1.UserService);
        repository = module.get((0, typeorm_1.getRepositoryToken)(user_entity_1.User));
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
            role: user_entity_1.UserRole.NODAL_OFFICER,
            stateUt: 'Maharashtra',
            isActive: true,
            createdAt: new Date(),
        };
        it('should successfully deactivate multiple users', async () => {
            const userIds = ['user-1', 'user-2', 'user-3'];
            mockRepository.findOne.mockResolvedValue(mockUser);
            mockRepository.update.mockResolvedValue({ affected: 1 });
            const result = await service.bulkDeactivate(userIds, user_entity_1.UserRole.MOSPI_REVIEWER, 'Maharashtra');
            expect(result.successCount).toBe(3);
            expect(result.failedCount).toBe(0);
            expect(result.errors).toHaveLength(0);
            expect(mockRepository.update).toHaveBeenCalledTimes(3);
        });
        it('should handle partial failures gracefully', async () => {
            const userIds = ['user-1', 'user-2', 'user-3'];
            mockRepository.findOne
                .mockResolvedValueOnce(mockUser)
                .mockRejectedValueOnce(new common_1.NotFoundException('User not found'))
                .mockResolvedValueOnce(mockUser);
            mockRepository.update.mockResolvedValue({ affected: 1 });
            const result = await service.bulkDeactivate(userIds, user_entity_1.UserRole.MOSPI_REVIEWER, 'Maharashtra');
            expect(result.successCount).toBe(2);
            expect(result.failedCount).toBe(1);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].userId).toBe('user-2');
            expect(result.errors[0].error).toBe('User not found');
        });
        it('should throw ForbiddenException for NODAL_OFFICER role', async () => {
            const userIds = ['user-1'];
            await expect(service.bulkDeactivate(userIds, user_entity_1.UserRole.NODAL_OFFICER, 'Maharashtra')).rejects.toThrow(common_1.ForbiddenException);
        });
        it('should allow STATE_APPROVER to bulk deactivate', async () => {
            const userIds = ['user-1'];
            mockRepository.findOne.mockResolvedValue(mockUser);
            mockRepository.update.mockResolvedValue({ affected: 1 });
            const result = await service.bulkDeactivate(userIds, user_entity_1.UserRole.STATE_APPROVER, 'Maharashtra');
            expect(result.successCount).toBe(1);
            expect(result.failedCount).toBe(0);
        });
        it('should allow MoSPI_REVIEWER to bulk deactivate', async () => {
            const userIds = ['user-1'];
            mockRepository.findOne.mockResolvedValue(mockUser);
            mockRepository.update.mockResolvedValue({ affected: 1 });
            const result = await service.bulkDeactivate(userIds, user_entity_1.UserRole.MOSPI_REVIEWER, 'Maharashtra');
            expect(result.successCount).toBe(1);
            expect(result.failedCount).toBe(0);
        });
        it('should allow MoSPI_APPROVER to bulk deactivate', async () => {
            const userIds = ['user-1'];
            mockRepository.findOne.mockResolvedValue(mockUser);
            mockRepository.update.mockResolvedValue({ affected: 1 });
            const result = await service.bulkDeactivate(userIds, user_entity_1.UserRole.MOSPI_APPROVER, 'Maharashtra');
            expect(result.successCount).toBe(1);
            expect(result.failedCount).toBe(0);
        });
        it('should handle empty userIds array', async () => {
            const userIds = [];
            const result = await service.bulkDeactivate(userIds, user_entity_1.UserRole.MOSPI_REVIEWER, 'Maharashtra');
            expect(result.successCount).toBe(0);
            expect(result.failedCount).toBe(0);
            expect(result.errors).toHaveLength(0);
        });
    });
});
//# sourceMappingURL=user.service.spec.js.map