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
exports.Submission = exports.SubmissionStatus = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("./user.entity");
const final_score_entity_1 = require("./final-score.entity");
var SubmissionStatus;
(function (SubmissionStatus) {
    SubmissionStatus["DRAFT"] = "DRAFT";
    SubmissionStatus["SUBMITTED_TO_STATE"] = "SUBMITTED_TO_STATE";
    SubmissionStatus["SUBMITTED_TO_MOSPI_REVIEWER"] = "SUBMITTED_TO_MOSPI_REVIEWER";
    SubmissionStatus["SUBMITTED_TO_MOSPI_APPROVER"] = "SUBMITTED_TO_MOSPI_APPROVER";
    SubmissionStatus["REJECTED"] = "REJECTED";
    SubmissionStatus["REJECTED_FINAL"] = "REJECTED_FINAL";
    SubmissionStatus["RETURNED_FROM_STATE"] = "RETURNED_FROM_STATE";
    SubmissionStatus["RETURNED_FROM_MOSPI"] = "RETURNED_FROM_MOSPI";
    SubmissionStatus["APPROVED"] = "APPROVED";
})(SubmissionStatus || (exports.SubmissionStatus = SubmissionStatus = {}));
let Submission = class Submission {
};
exports.Submission = Submission;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Submission.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'submission_id', unique: true }),
    __metadata("design:type", String)
], Submission.prototype, "submissionId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'state_ut' }),
    __metadata("design:type", String)
], Submission.prototype, "stateUt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'submitted_by' }),
    __metadata("design:type", String)
], Submission.prototype, "submittedBy", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User),
    (0, typeorm_1.JoinColumn)({ name: 'submitted_by' }),
    __metadata("design:type", user_entity_1.User)
], Submission.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'rejection_count', default: 0 }),
    __metadata("design:type", Number)
], Submission.prototype, "rejectionCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'form_data', type: 'jsonb' }),
    __metadata("design:type", Object)
], Submission.prototype, "formData", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'review_comments',
        type: 'jsonb',
        default: () => "'[]'",
    }),
    __metadata("design:type", Array)
], Submission.prototype, "reviewComments", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'attached_files',
        type: 'jsonb',
        array: true,
        default: [],
    }),
    __metadata("design:type", Array)
], Submission.prototype, "attachedFiles", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: SubmissionStatus,
        default: SubmissionStatus.SUBMITTED_TO_STATE,
    }),
    __metadata("design:type", String)
], Submission.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'current_owner_role',
        type: 'enum',
        enum: user_entity_1.UserRole,
        default: user_entity_1.UserRole.STATE_APPROVER,
    }),
    __metadata("design:type", String)
], Submission.prototype, "currentOwnerRole", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Submission.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Submission.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => final_score_entity_1.FinalScore, (finalScore) => finalScore.submission),
    __metadata("design:type", final_score_entity_1.FinalScore)
], Submission.prototype, "finalScore", void 0);
exports.Submission = Submission = __decorate([
    (0, typeorm_1.Entity)('submissions'),
    (0, typeorm_1.Index)(['stateUt']),
    (0, typeorm_1.Index)(['status']),
    (0, typeorm_1.Index)(['submittedBy']),
    (0, typeorm_1.Index)(['currentOwnerRole'])
], Submission);
//# sourceMappingURL=submission.entity.js.map