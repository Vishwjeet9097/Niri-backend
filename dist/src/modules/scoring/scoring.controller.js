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
exports.ScoringController = void 0;
const common_1 = require("@nestjs/common");
const scoring_service_1 = require("./scoring.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const user_entity_1 = require("../../entities/user.entity");
let ScoringController = class ScoringController {
    constructor(scoringService) {
        this.scoringService = scoringService;
    }
    async getRankings(req) {
        const rankings = await this.scoringService.getScoreRankings();
        return {
            status: true,
            data: rankings,
            message: 'Score rankings retrieved successfully',
            timestamp: new Date().toISOString(),
        };
    }
    async getStatistics(req) {
        const statistics = await this.scoringService.getScoreStatistics();
        return {
            status: true,
            data: statistics,
            message: 'Score statistics retrieved successfully',
            timestamp: new Date().toISOString(),
        };
    }
    async getStateScore(stateUt, req) {
        const score = await this.scoringService.getStateScore(stateUt);
        return {
            status: true,
            data: score,
            message: score ? 'State score retrieved successfully' : 'No score found for this state',
            timestamp: new Date().toISOString(),
        };
    }
    async calculateScore(submissionId, req) {
        const cleanSubmissionId = submissionId.startsWith(':')
            ? submissionId.substring(1)
            : submissionId;
        const score = await this.scoringService.calculateScore(cleanSubmissionId, req.user.id);
        return {
            status: true,
            data: score,
            message: 'Score calculated successfully',
            timestamp: new Date().toISOString(),
        };
    }
};
exports.ScoringController = ScoringController;
__decorate([
    (0, common_1.Get)('rankings'),
    (0, roles_guard_1.Roles)(user_entity_1.UserRole.MOSPI_REVIEWER, user_entity_1.UserRole.MOSPI_APPROVER),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ScoringController.prototype, "getRankings", null);
__decorate([
    (0, common_1.Get)('statistics'),
    (0, roles_guard_1.Roles)(user_entity_1.UserRole.MOSPI_REVIEWER, user_entity_1.UserRole.MOSPI_APPROVER),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ScoringController.prototype, "getStatistics", null);
__decorate([
    (0, common_1.Get)('state/:stateUt'),
    (0, roles_guard_1.Roles)(user_entity_1.UserRole.MOSPI_REVIEWER, user_entity_1.UserRole.MOSPI_APPROVER),
    __param(0, (0, common_1.Param)('stateUt')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ScoringController.prototype, "getStateScore", null);
__decorate([
    (0, common_1.Get)('calculate/:submissionId'),
    (0, roles_guard_1.Roles)(user_entity_1.UserRole.MOSPI_APPROVER),
    __param(0, (0, common_1.Param)('submissionId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ScoringController.prototype, "calculateScore", null);
exports.ScoringController = ScoringController = __decorate([
    (0, common_1.Controller)('scoring'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [scoring_service_1.ScoringService])
], ScoringController);
//# sourceMappingURL=scoring.controller.js.map