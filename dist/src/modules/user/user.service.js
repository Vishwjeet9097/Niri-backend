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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("../../entities/user.entity");
const bcrypt = require("bcryptjs");
let UserService = class UserService {
    constructor(userRepository) {
        this.userRepository = userRepository;
    }
    async findAll(userRole, userStateUt) {
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
        if (userRole === user_entity_1.UserRole.STATE_APPROVER) {
            query = query.andWhere('user.stateUt = :stateUt', { stateUt: userStateUt });
        }
        return query.getMany();
    }
    async findOne(id, userRole, userStateUt) {
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
            throw new common_1.NotFoundException('User not found');
        }
        if (userRole === user_entity_1.UserRole.STATE_APPROVER && user.stateUt !== userStateUt) {
            throw new common_1.ForbiddenException('Access denied');
        }
        return user;
    }
    async update(id, updateUserDto, userRole, userStateUt) {
        const user = await this.findOne(id, userRole, userStateUt);
        if (updateUserDto.role &&
            ![user_entity_1.UserRole.STATE_APPROVER, user_entity_1.UserRole.MOSPI_REVIEWER, user_entity_1.UserRole.MOSPI_APPROVER].includes(userRole)) {
            throw new common_1.ForbiddenException('Only State Approver and MoSPI roles can change user roles');
        }
        if (updateUserDto.stateUt && userRole === user_entity_1.UserRole.STATE_APPROVER) {
            throw new common_1.ForbiddenException('Cannot change state/UT');
        }
        await this.userRepository.update(id, updateUserDto);
        return this.findOne(id, userRole, userStateUt);
    }
    async deactivate(id, userRole, userStateUt) {
        await this.findOne(id, userRole, userStateUt);
        if (![user_entity_1.UserRole.STATE_APPROVER, user_entity_1.UserRole.MOSPI_REVIEWER, user_entity_1.UserRole.MOSPI_APPROVER].includes(userRole)) {
            throw new common_1.ForbiddenException('Only State Approver and MoSPI roles can deactivate users');
        }
        await this.userRepository.update(id, { isActive: false });
    }
    async bulkDeactivate(userIds, userRole, userStateUt) {
        if (![user_entity_1.UserRole.STATE_APPROVER, user_entity_1.UserRole.MOSPI_REVIEWER, user_entity_1.UserRole.MOSPI_APPROVER].includes(userRole)) {
            throw new common_1.ForbiddenException('Only State Approvers and MoSPI roles can bulk deactivate users');
        }
        const result = {
            successCount: 0,
            failedCount: 0,
            errors: [],
        };
        for (const userId of userIds) {
            try {
                const user = await this.findOne(userId, userRole, userStateUt);
                await this.userRepository.update(userId, { isActive: false });
                result.successCount++;
            }
            catch (error) {
                result.failedCount++;
                result.errors.push({
                    userId,
                    error: error.message || 'Unknown error occurred',
                });
            }
        }
        return result;
    }
    async getUsersByState(stateUt) {
        return this.userRepository.find({
            where: { stateUt, isActive: true },
            select: ['id', 'email', 'firstName', 'lastName', 'role', 'stateUt', 'isActive', 'createdAt'],
        });
    }
    async getUsersByRole(role, stateUt) {
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
    async createUser(createUserDto, approverRole, approverState) {
        const { email, password, firstName, lastName, role, stateUt } = createUserDto;
        console.log('🔍 Debug - User Creation:');
        console.log('Approver Role:', approverRole);
        console.log('Approver State:', approverState);
        console.log('Requested State:', stateUt);
        console.log('Role Check:', approverRole === user_entity_1.UserRole.STATE_APPROVER);
        const existingUser = await this.userRepository.findOne({ where: { email } });
        if (existingUser) {
            throw new common_1.ConflictException('User with this email already exists');
        }
        if (approverRole === user_entity_1.UserRole.STATE_APPROVER) {
            console.log('🚨 State Approver restriction check:');
            console.log('Requested state:', stateUt);
            console.log('Approver state:', approverState);
            console.log('States match:', stateUt === approverState);
            if (stateUt !== approverState) {
                throw new common_1.ForbiddenException(`You can only create users for ${approverState}. Cannot create user for ${stateUt}`);
            }
        }
        const hashedPassword = await bcrypt.hash(password, 12);
        const user = this.userRepository.create({
            email,
            password: hashedPassword,
            firstName,
            lastName,
            role,
            stateUt,
        });
        const savedUser = await this.userRepository.save(user);
        const { password: _, ...userWithoutPassword } = savedUser;
        return {
            user: userWithoutPassword,
            message: `User created successfully for ${stateUt}`,
        };
    }
};
exports.UserService = UserService;
exports.UserService = UserService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], UserService);
//# sourceMappingURL=user.service.js.map