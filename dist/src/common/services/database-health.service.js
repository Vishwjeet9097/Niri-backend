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
exports.DatabaseHealthService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("../../entities/user.entity");
let DatabaseHealthService = class DatabaseHealthService {
    constructor(userRepository) {
        this.userRepository = userRepository;
    }
    async checkDatabaseHealth() {
        try {
            await this.userRepository.query("SELECT 1");
            const result = await this.userRepository.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_name = 'users' AND table_schema = 'public'
      `);
            const hasUsersTable = result[0]?.count > 0;
            let userCount = 0;
            if (hasUsersTable) {
                const userCountResult = await this.userRepository.query("SELECT COUNT(*) as count FROM users");
                userCount = parseInt(userCountResult[0]?.count || "0");
            }
            return {
                isConnected: true,
                hasUsersTable,
                userCount,
            };
        }
        catch (error) {
            return {
                isConnected: false,
                hasUsersTable: false,
                userCount: 0,
                error: error.message,
            };
        }
    }
    async checkUsersTableExists() {
        try {
            const result = await this.userRepository.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'users' AND table_schema = 'public'
        )
      `);
            return result[0]?.exists || false;
        }
        catch (error) {
            return false;
        }
    }
};
exports.DatabaseHealthService = DatabaseHealthService;
exports.DatabaseHealthService = DatabaseHealthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], DatabaseHealthService);
//# sourceMappingURL=database-health.service.js.map