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
exports.ReportController = void 0;
const common_1 = require("@nestjs/common");
const report_service_1 = require("./report.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const user_entity_1 = require("../../entities/user.entity");
let ReportController = class ReportController {
    constructor(reportService) {
        this.reportService = reportService;
    }
    async getRankings() {
        return this.reportService.getRankings();
    }
    async getFullReport() {
        return this.reportService.getReportData();
    }
    async getStateReport(stateUt, req) {
        if (req.user.role === user_entity_1.UserRole.STATE_APPROVER && req.user.stateUt !== stateUt) {
            throw new Error('Access denied');
        }
        return this.reportService.getStateReport(stateUt);
    }
    async exportRankings(format = 'json', res) {
        const data = await this.reportService.exportRankings(format);
        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=niri-rankings.csv');
            res.send(data);
        }
        else {
            res.json(data);
        }
    }
    async getSubmissionStatusReport() {
        return this.reportService.getSubmissionStatusReport();
    }
};
exports.ReportController = ReportController;
__decorate([
    (0, common_1.Get)('ranking'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ReportController.prototype, "getRankings", null);
__decorate([
    (0, common_1.Get)('full-report'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ReportController.prototype, "getFullReport", null);
__decorate([
    (0, common_1.Get)('state/:stateUt'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_guard_1.Roles)(user_entity_1.UserRole.STATE_APPROVER, user_entity_1.UserRole.MOSPI_REVIEWER, user_entity_1.UserRole.MOSPI_APPROVER),
    __param(0, (0, common_1.Param)('stateUt')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ReportController.prototype, "getStateReport", null);
__decorate([
    (0, common_1.Get)('export'),
    __param(0, (0, common_1.Query)('format')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ReportController.prototype, "exportRankings", null);
__decorate([
    (0, common_1.Get)('submission-status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ReportController.prototype, "getSubmissionStatusReport", null);
exports.ReportController = ReportController = __decorate([
    (0, common_1.Controller)('report'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [report_service_1.ReportService])
], ReportController);
//# sourceMappingURL=report.controller.js.map