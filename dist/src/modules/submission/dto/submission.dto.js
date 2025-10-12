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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubmissionQueryDto = exports.ResubmitDto = exports.FinalRejectDto = exports.StateRejectDto = exports.SendBackToStateDto = exports.ForwardToMoSPIApproverDto = exports.ForwardToMoSPIReviewerDto = exports.UpdateStatusDto = exports.ForwardToMoSPIDto = exports.AddCommentDto = exports.UpdateSubmissionDto = exports.CreateSubmissionDto = void 0;
const class_validator_1 = require("class-validator");
const submission_entity_1 = require("../../../entities/submission.entity");
const user_entity_1 = require("../../../entities/user.entity");
class CreateSubmissionDto {
}
exports.CreateSubmissionDto = CreateSubmissionDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSubmissionDto.prototype, "submissionId", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateSubmissionDto.prototype, "formData", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(submission_entity_1.SubmissionStatus),
    __metadata("design:type", String)
], CreateSubmissionDto.prototype, "status", void 0);
class UpdateSubmissionDto {
}
exports.UpdateSubmissionDto = UpdateSubmissionDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateSubmissionDto.prototype, "formData", void 0);
class AddCommentDto {
}
exports.AddCommentDto = AddCommentDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AddCommentDto.prototype, "text", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(['comment', 'rejection', 'approval']),
    __metadata("design:type", String)
], AddCommentDto.prototype, "type", void 0);
class ForwardToMoSPIDto {
}
exports.ForwardToMoSPIDto = ForwardToMoSPIDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ForwardToMoSPIDto.prototype, "comment", void 0);
class UpdateStatusDto {
}
exports.UpdateStatusDto = UpdateStatusDto;
__decorate([
    (0, class_validator_1.IsEnum)(submission_entity_1.SubmissionStatus),
    __metadata("design:type", String)
], UpdateStatusDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateStatusDto.prototype, "comment", void 0);
class ForwardToMoSPIReviewerDto {
}
exports.ForwardToMoSPIReviewerDto = ForwardToMoSPIReviewerDto;
__decorate([
    (0, class_validator_1.IsEnum)(submission_entity_1.SubmissionStatus),
    __metadata("design:type", String)
], ForwardToMoSPIReviewerDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ForwardToMoSPIReviewerDto.prototype, "comment", void 0);
class ForwardToMoSPIApproverDto {
}
exports.ForwardToMoSPIApproverDto = ForwardToMoSPIApproverDto;
__decorate([
    (0, class_validator_1.IsEnum)(submission_entity_1.SubmissionStatus),
    __metadata("design:type", String)
], ForwardToMoSPIApproverDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ForwardToMoSPIApproverDto.prototype, "comment", void 0);
class SendBackToStateDto {
}
exports.SendBackToStateDto = SendBackToStateDto;
__decorate([
    (0, class_validator_1.IsEnum)(submission_entity_1.SubmissionStatus),
    __metadata("design:type", String)
], SendBackToStateDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SendBackToStateDto.prototype, "comment", void 0);
class StateRejectDto {
}
exports.StateRejectDto = StateRejectDto;
__decorate([
    (0, class_validator_1.IsEnum)(submission_entity_1.SubmissionStatus),
    __metadata("design:type", String)
], StateRejectDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], StateRejectDto.prototype, "comment", void 0);
class FinalRejectDto {
}
exports.FinalRejectDto = FinalRejectDto;
__decorate([
    (0, class_validator_1.IsEnum)(submission_entity_1.SubmissionStatus),
    __metadata("design:type", String)
], FinalRejectDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], FinalRejectDto.prototype, "comment", void 0);
class ResubmitDto {
}
exports.ResubmitDto = ResubmitDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], ResubmitDto.prototype, "formData", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ResubmitDto.prototype, "comment", void 0);
class SubmissionQueryDto {
}
exports.SubmissionQueryDto = SubmissionQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], SubmissionQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SubmissionQueryDto.prototype, "stateUt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SubmissionQueryDto.prototype, "submittedBy", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(user_entity_1.UserRole),
    __metadata("design:type", String)
], SubmissionQueryDto.prototype, "currentOwnerRole", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SubmissionQueryDto.prototype, "page", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SubmissionQueryDto.prototype, "limit", void 0);
//# sourceMappingURL=submission.dto.js.map