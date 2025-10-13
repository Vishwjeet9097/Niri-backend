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
exports.SubmissionController = void 0;
const common_1 = require("@nestjs/common");
const submission_service_1 = require("./submission.service");
const submission_dto_1 = require("./dto/submission.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const user_entity_1 = require("../../entities/user.entity");
let SubmissionController = class SubmissionController {
    constructor(submissionService) {
        this.submissionService = submissionService;
    }
    async create(createSubmissionDto, req) {
        return this.submissionService.create(createSubmissionDto, req.user.id, req.user.role, req.user.stateUt);
    }
    async findAll(queryDto, req) {
        if (queryDto.status) {
            const statusArray = queryDto.status
                .split(",")
                .map((s) => s.trim());
            const validStatuses = [
                "DRAFT",
                "SUBMITTED_TO_STATE",
                "SUBMITTED_TO_MOSPI_REVIEWER",
                "SUBMITTED_TO_MOSPI_APPROVER",
                "REJECTED",
                "REJECTED_FINAL",
                "RETURNED_FROM_STATE",
                "RETURNED_FROM_MOSPI",
                "APPROVED",
            ];
            const invalidStatuses = statusArray.filter((status) => !validStatuses.includes(status));
            if (invalidStatuses.length > 0) {
                throw new common_1.BadRequestException(`Invalid status values: ${invalidStatuses.join(", ")}`);
            }
        }
        return this.submissionService.findAll(queryDto, req.user.role, req.user.stateUt, req.user.id);
    }
    async debugFindAll(req) {
        const query = this.submissionService["submissionRepository"]
            .createQueryBuilder("submission")
            .leftJoinAndSelect("submission.user", "user")
            .leftJoinAndSelect("submission.finalScore", "finalScore")
            .orderBy("submission.createdAt", "DESC");
        const [submissions, total] = await query.getManyAndCount();
        return {
            status: true,
            data: {
                submissions,
                total,
                userInfo: {
                    role: req.user.role,
                    stateUt: req.user.stateUt,
                    userId: req.user.id,
                },
            },
            message: "Debug: All submissions retrieved without filters",
            timestamp: new Date().toISOString(),
        };
    }
    async findOne(id, req) {
        return this.submissionService.findOne(id, req.user.role, req.user.stateUt);
    }
    async update(id, updateSubmissionDto, req) {
        return this.submissionService.update(id, updateSubmissionDto, req.user.id, req.user.role, req.user.stateUt);
    }
    async addComment(id, addCommentDto, req) {
        return this.submissionService.addComment(id, addCommentDto, req.user.id, req.user.role, req.user.stateUt);
    }
    async updateStatus(id, updateStatusDto, req) {
        return this.submissionService.updateStatus(id, updateStatusDto, req.user.id, req.user.role, req.user.stateUt);
    }
    async forwardToMoSPIReviewer(id, forwardDto, req) {
        return this.submissionService.forwardToMoSPIReviewer(id, forwardDto, req.user.id, req.user.role, req.user.stateUt);
    }
    async forwardToMoSPIApprover(id, forwardDto, req) {
        return this.submissionService.forwardToMoSPIApprover(id, forwardDto, req.user.id, req.user.role, req.user.stateUt);
    }
    async sendBackToState(id, sendBackDto, req) {
        return this.submissionService.sendBackToState(id, sendBackDto, req.user.id, req.user.role, req.user.stateUt);
    }
    async forwardToMoSPI(id, forwardDto, req) {
        return this.submissionService.forwardToMoSPI(id, forwardDto, req.user.id, req.user.role, req.user.stateUt);
    }
    async stateReject(id, rejectDto, req) {
        return this.submissionService.stateReject(id, rejectDto, req.user.id, req.user.role, req.user.stateUt);
    }
    async finalReject(id, rejectDto, req) {
        return this.submissionService.finalReject(id, rejectDto, req.user.id, req.user.role, req.user.stateUt);
    }
    async resubmit(id, resubmitDto, req) {
        return this.submissionService.resubmit(id, resubmitDto, req.user.id, req.user.role, req.user.stateUt);
    }
    async submitToState(id, req) {
        return this.submissionService.submitToState(id, req.user.id, req.user.role, req.user.stateUt);
    }
    async approve(id, approveDto, req) {
        return this.submissionService.approve(id, approveDto, req.user.id, req.user.role, req.user.stateUt);
    }
};
exports.SubmissionController = SubmissionController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_guard_1.Roles)(user_entity_1.UserRole.NODAL_OFFICER),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [submission_dto_1.CreateSubmissionDto, Object]),
    __metadata("design:returntype", Promise)
], SubmissionController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_guard_1.Roles)(user_entity_1.UserRole.NODAL_OFFICER, user_entity_1.UserRole.STATE_APPROVER, user_entity_1.UserRole.MOSPI_REVIEWER, user_entity_1.UserRole.MOSPI_APPROVER),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SubmissionController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)("debug/all"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_guard_1.Roles)(user_entity_1.UserRole.NODAL_OFFICER, user_entity_1.UserRole.STATE_APPROVER, user_entity_1.UserRole.MOSPI_REVIEWER, user_entity_1.UserRole.MOSPI_APPROVER),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SubmissionController.prototype, "debugFindAll", null);
__decorate([
    (0, common_1.Get)(":id"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_guard_1.Roles)(user_entity_1.UserRole.NODAL_OFFICER, user_entity_1.UserRole.STATE_APPROVER, user_entity_1.UserRole.MOSPI_REVIEWER, user_entity_1.UserRole.MOSPI_APPROVER),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], SubmissionController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(":id"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_guard_1.Roles)(user_entity_1.UserRole.NODAL_OFFICER),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, submission_dto_1.UpdateSubmissionDto, Object]),
    __metadata("design:returntype", Promise)
], SubmissionController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(":id/comment"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_guard_1.Roles)(user_entity_1.UserRole.STATE_APPROVER, user_entity_1.UserRole.MOSPI_REVIEWER, user_entity_1.UserRole.MOSPI_APPROVER),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, submission_dto_1.AddCommentDto, Object]),
    __metadata("design:returntype", Promise)
], SubmissionController.prototype, "addComment", null);
__decorate([
    (0, common_1.Post)("update-status/:id"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_guard_1.Roles)(user_entity_1.UserRole.NODAL_OFFICER, user_entity_1.UserRole.STATE_APPROVER, user_entity_1.UserRole.MOSPI_REVIEWER, user_entity_1.UserRole.MOSPI_APPROVER),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, submission_dto_1.UpdateStatusDto, Object]),
    __metadata("design:returntype", Promise)
], SubmissionController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.Post)("forward-to-mospi-reviewer/:id"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_guard_1.Roles)(user_entity_1.UserRole.STATE_APPROVER),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, submission_dto_1.ForwardToMoSPIReviewerDto, Object]),
    __metadata("design:returntype", Promise)
], SubmissionController.prototype, "forwardToMoSPIReviewer", null);
__decorate([
    (0, common_1.Post)("forward-to-mospi-approver/:id"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_guard_1.Roles)(user_entity_1.UserRole.MOSPI_REVIEWER),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, submission_dto_1.ForwardToMoSPIApproverDto, Object]),
    __metadata("design:returntype", Promise)
], SubmissionController.prototype, "forwardToMoSPIApprover", null);
__decorate([
    (0, common_1.Post)("send-back-to-state/:id"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_guard_1.Roles)(user_entity_1.UserRole.MOSPI_REVIEWER, user_entity_1.UserRole.MOSPI_APPROVER),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, submission_dto_1.SendBackToStateDto, Object]),
    __metadata("design:returntype", Promise)
], SubmissionController.prototype, "sendBackToState", null);
__decorate([
    (0, common_1.Post)("forward-to-mospi/:id"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_guard_1.Roles)(user_entity_1.UserRole.STATE_APPROVER),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, submission_dto_1.ForwardToMoSPIDto, Object]),
    __metadata("design:returntype", Promise)
], SubmissionController.prototype, "forwardToMoSPI", null);
__decorate([
    (0, common_1.Post)("state-reject/:id"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_guard_1.Roles)(user_entity_1.UserRole.STATE_APPROVER, user_entity_1.UserRole.MOSPI_APPROVER),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, submission_dto_1.StateRejectDto, Object]),
    __metadata("design:returntype", Promise)
], SubmissionController.prototype, "stateReject", null);
__decorate([
    (0, common_1.Post)("final-reject/:id"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_guard_1.Roles)(user_entity_1.UserRole.MOSPI_APPROVER, user_entity_1.UserRole.STATE_APPROVER),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, submission_dto_1.FinalRejectDto, Object]),
    __metadata("design:returntype", Promise)
], SubmissionController.prototype, "finalReject", null);
__decorate([
    (0, common_1.Post)("resubmit/:id"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_guard_1.Roles)(user_entity_1.UserRole.NODAL_OFFICER),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, submission_dto_1.ResubmitDto, Object]),
    __metadata("design:returntype", Promise)
], SubmissionController.prototype, "resubmit", null);
__decorate([
    (0, common_1.Post)("submit-to-state/:id"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_guard_1.Roles)(user_entity_1.UserRole.NODAL_OFFICER),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], SubmissionController.prototype, "submitToState", null);
__decorate([
    (0, common_1.Post)("approve/:id"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_guard_1.Roles)(user_entity_1.UserRole.MOSPI_APPROVER),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], SubmissionController.prototype, "approve", null);
exports.SubmissionController = SubmissionController = __decorate([
    (0, common_1.Controller)("submission"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [submission_service_1.SubmissionService])
], SubmissionController);
//# sourceMappingURL=submission.controller.js.map