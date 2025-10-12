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
exports.ReportService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const final_score_entity_1 = require("../../entities/final-score.entity");
const submission_entity_1 = require("../../entities/submission.entity");
let ReportService = class ReportService {
    constructor(finalScoreRepository, submissionRepository) {
        this.finalScoreRepository = finalScoreRepository;
        this.submissionRepository = submissionRepository;
    }
    async getRankings() {
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
    async getReportData() {
        const rankings = await this.getRankings();
        if (rankings.length === 0) {
            return {
                rankings: [],
                statistics: {
                    totalStates: 0,
                    averageScore: 0,
                    highestScore: 0,
                    lowestScore: 0,
                    scoreDistribution: {},
                },
                stateComparison: [],
            };
        }
        const totalScores = rankings.map(r => r.totalScore);
        const averageScore = totalScores.reduce((sum, score) => sum + score, 0) / totalScores.length;
        const highestScore = Math.max(...totalScores);
        const lowestScore = Math.min(...totalScores);
        const scoreDistribution = {
            '90-100': rankings.filter(r => r.totalScore >= 90).length,
            '80-89': rankings.filter(r => r.totalScore >= 80 && r.totalScore < 90).length,
            '70-79': rankings.filter(r => r.totalScore >= 70 && r.totalScore < 79).length,
            '60-69': rankings.filter(r => r.totalScore >= 60 && r.totalScore < 70).length,
            '50-59': rankings.filter(r => r.totalScore >= 50 && r.totalScore < 60).length,
            'Below 50': rankings.filter(r => r.totalScore < 50).length,
        };
        const stateComparison = rankings.map(ranking => {
            const percentile = ((rankings.length - ranking.rank + 1) / rankings.length) * 100;
            return {
                stateUt: ranking.stateUt,
                score: ranking.totalScore,
                rank: ranking.rank,
                percentile: Math.round(percentile * 100) / 100,
            };
        });
        return {
            rankings,
            statistics: {
                totalStates: rankings.length,
                averageScore: Math.round(averageScore * 100) / 100,
                highestScore,
                lowestScore,
                scoreDistribution,
            },
            stateComparison,
        };
    }
    async getStateReport(stateUt) {
        const score = await this.finalScoreRepository.findOne({
            where: { stateUt },
            relations: ['submission'],
            order: { createdAt: 'DESC' },
        });
        if (!score) {
            throw new Error('No score found for this state');
        }
        const rankings = await this.getRankings();
        const stateRanking = rankings.find(r => r.stateUt === stateUt);
        return {
            stateUt: score.stateUt,
            totalScore: score.totalScore,
            scoreBreakdown: score.scoreBreakdown,
            rank: stateRanking?.rank || null,
            percentile: stateRanking ? ((rankings.length - stateRanking.rank + 1) / rankings.length) * 100 : null,
            approvedAt: score.createdAt,
            approvedBy: score.approvedBy,
            methodology: score.calculationMethodology,
        };
    }
    async exportRankings(format = 'json') {
        const rankings = await this.getRankings();
        if (format === 'csv') {
            const csvHeaders = 'Rank,State/UT,Total Score,Percentage,Approved At,Submission ID\n';
            const csvRows = rankings.map(r => `${r.rank},"${r.stateUt}",${r.totalScore},${r.percentage},"${r.approvedAt.toISOString()}",${r.submissionId}`).join('\n');
            return csvHeaders + csvRows;
        }
        return rankings;
    }
    async getSubmissionStatusReport() {
        const statusCounts = await this.submissionRepository
            .createQueryBuilder('submission')
            .select('submission.status', 'status')
            .addSelect('submission.stateUt', 'stateUt')
            .addSelect('COUNT(*)', 'count')
            .groupBy('submission.status, submission.stateUt')
            .getRawMany();
        const report = statusCounts.reduce((acc, item) => {
            if (!acc[item.stateUt]) {
                acc[item.stateUt] = {};
            }
            acc[item.stateUt][item.status] = parseInt(item.count);
            return acc;
        }, {});
        return report;
    }
};
exports.ReportService = ReportService;
exports.ReportService = ReportService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(final_score_entity_1.FinalScore)),
    __param(1, (0, typeorm_1.InjectRepository)(submission_entity_1.Submission)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], ReportService);
//# sourceMappingURL=report.service.js.map