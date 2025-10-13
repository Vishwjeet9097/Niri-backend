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
exports.FinalScore = void 0;
const typeorm_1 = require("typeorm");
const submission_entity_1 = require("./submission.entity");
let FinalScore = class FinalScore {
};
exports.FinalScore = FinalScore;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], FinalScore.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'submission_id' }),
    __metadata("design:type", String)
], FinalScore.prototype, "submissionId", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => submission_entity_1.Submission),
    (0, typeorm_1.JoinColumn)({ name: 'submission_id' }),
    __metadata("design:type", submission_entity_1.Submission)
], FinalScore.prototype, "submission", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'state_ut' }),
    __metadata("design:type", String)
], FinalScore.prototype, "stateUt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_score', type: 'decimal', precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], FinalScore.prototype, "totalScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'score_breakdown', type: 'jsonb' }),
    __metadata("design:type", Object)
], FinalScore.prototype, "scoreBreakdown", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'calculation_methodology', type: 'text' }),
    __metadata("design:type", String)
], FinalScore.prototype, "calculationMethodology", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'approved_by' }),
    __metadata("design:type", String)
], FinalScore.prototype, "approvedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'category_scores', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], FinalScore.prototype, "categoryScores", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'scoring_version', type: 'varchar', default: '2.0' }),
    __metadata("design:type", String)
], FinalScore.prototype, "scoringVersion", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], FinalScore.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], FinalScore.prototype, "updatedAt", void 0);
exports.FinalScore = FinalScore = __decorate([
    (0, typeorm_1.Entity)('final_scores'),
    (0, typeorm_1.Index)(['stateUt']),
    (0, typeorm_1.Index)(['totalScore']),
    (0, typeorm_1.Index)(['createdAt'])
], FinalScore);
//# sourceMappingURL=final-score.entity.js.map