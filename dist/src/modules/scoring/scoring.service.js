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
exports.ScoringService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const submission_entity_1 = require("../../entities/submission.entity");
const final_score_entity_1 = require("../../entities/final-score.entity");
let ScoringService = class ScoringService {
    constructor(submissionRepository, finalScoreRepository) {
        this.submissionRepository = submissionRepository;
        this.finalScoreRepository = finalScoreRepository;
    }
    async calculateScore(submissionId, approvedBy) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(submissionId)) {
            throw new Error(`Invalid submission ID format: ${submissionId}`);
        }
        const submission = await this.submissionRepository.findOne({
            where: { id: submissionId },
        });
        if (!submission) {
            throw new Error(`Submission not found with ID: ${submissionId}`);
        }
        if (submission.status !== submission_entity_1.SubmissionStatus.APPROVED) {
            throw new Error(`Can only calculate score for approved submissions. Current status: ${submission.status}`);
        }
        const existingScore = await this.finalScoreRepository.findOne({
            where: { submissionId },
        });
        if (existingScore) {
            return existingScore;
        }
        const scoreBreakdown = this.performScoreCalculation(submission.formData);
        const finalScore = this.finalScoreRepository.create({
            submissionId,
            stateUt: submission.stateUt,
            totalScore: scoreBreakdown.totalScore,
            scoreBreakdown: scoreBreakdown,
            calculationMethodology: scoreBreakdown.methodology,
            approvedBy,
        });
        return this.finalScoreRepository.save(finalScore);
    }
    performScoreCalculation(formData) {
        const calculations = [];
        let totalScore = 0;
        let maxPossibleScore = 0;
        const scoringRules = {
            capexToGsdpRatio: {
                weight: 0.25,
                maxScore: 25,
                calculation: (value) => Math.min(value * 10, 25),
            },
            infrastructureInvestment: {
                weight: 0.2,
                maxScore: 20,
                calculation: (value) => Math.min(value * 2, 20),
            },
            projectCompletionRate: {
                weight: 0.2,
                maxScore: 20,
                calculation: (value) => value * 0.2,
            },
            qualityIndex: {
                weight: 0.15,
                maxScore: 15,
                calculation: (value) => value * 0.15,
            },
            sustainabilityScore: {
                weight: 0.1,
                maxScore: 10,
                calculation: (value) => value * 0.1,
            },
            innovationIndex: {
                weight: 0.1,
                maxScore: 10,
                calculation: (value) => value * 0.1,
            },
        };
        Object.entries(scoringRules).forEach(([indicator, rule]) => {
            const value = formData[indicator] || 0;
            const score = rule.calculation(value);
            calculations.push({
                indicator,
                value,
                weight: rule.weight,
                score,
                maxScore: rule.maxScore,
            });
            totalScore += score;
            maxPossibleScore += rule.maxScore;
        });
        const percentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
        return {
            totalScore: Math.round(totalScore * 100) / 100,
            maxPossibleScore,
            percentage: Math.round(percentage * 100) / 100,
            calculations,
            methodology: 'NIRI Scoring Methodology v1.0 - Based on BRD requirements for infrastructure readiness assessment',
        };
    }
    async getScoreRankings() {
        const scores = await this.finalScoreRepository
            .createQueryBuilder('finalScore')
            .leftJoinAndSelect('finalScore.submission', 'submission')
            .orderBy('finalScore.totalScore', 'DESC')
            .getMany();
        return scores.map((score, index) => ({
            rank: index + 1,
            stateUt: score.stateUt,
            totalScore: score.totalScore,
            percentage: score.scoreBreakdown.percentage,
            approvedAt: score.createdAt,
            submissionId: score.submissionId,
        }));
    }
    async getStateScore(stateUt) {
        return this.finalScoreRepository.findOne({
            where: { stateUt },
            relations: ['submission'],
            order: { createdAt: 'DESC' },
        });
    }
    async getScoreStatistics() {
        const scores = await this.finalScoreRepository.find();
        if (scores.length === 0) {
            return {
                totalStates: 0,
                averageScore: 0,
                highestScore: 0,
                lowestScore: 0,
                scoreDistribution: {},
            };
        }
        const totalScores = scores.map((s) => s.totalScore);
        const averageScore = totalScores.reduce((sum, score) => sum + score, 0) / totalScores.length;
        const highestScore = Math.max(...totalScores);
        const lowestScore = Math.min(...totalScores);
        const scoreDistribution = {
            '90-100': scores.filter((s) => s.totalScore >= 90).length,
            '80-89': scores.filter((s) => s.totalScore >= 80 && s.totalScore < 90).length,
            '70-79': scores.filter((s) => s.totalScore >= 70 && s.totalScore < 80).length,
            '60-69': scores.filter((s) => s.totalScore >= 60 && s.totalScore < 70).length,
            '50-59': scores.filter((s) => s.totalScore >= 50 && s.totalScore < 60).length,
            'Below 50': scores.filter((s) => s.totalScore < 50).length,
        };
        return {
            totalStates: scores.length,
            averageScore: Math.round(averageScore * 100) / 100,
            highestScore,
            lowestScore,
            scoreDistribution,
        };
    }
};
exports.ScoringService = ScoringService;
exports.ScoringService = ScoringService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(submission_entity_1.Submission)),
    __param(1, (0, typeorm_1.InjectRepository)(final_score_entity_1.FinalScore)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], ScoringService);
//# sourceMappingURL=scoring.service.js.map