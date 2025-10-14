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
var ScoringService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScoringService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const submission_entity_1 = require("../../entities/submission.entity");
const final_score_entity_1 = require("../../entities/final-score.entity");
let ScoringService = ScoringService_1 = class ScoringService {
    constructor(submissionRepository, finalScoreRepository) {
        this.submissionRepository = submissionRepository;
        this.finalScoreRepository = finalScoreRepository;
        this.logger = new common_1.Logger(ScoringService_1.name);
    }
    async calculateScore(submissionId, userId) {
        this.logger.log(`Calculating score for submission: ${submissionId}`);
        const submission = await this.submissionRepository.findOne({
            where: { id: submissionId },
        });
        if (!submission) {
            throw new common_1.NotFoundException(`Submission with ID ${submissionId} not found`);
        }
        if (submission.status !== 'APPROVED') {
            throw new Error(`Submission must be APPROVED to calculate score. Current status: ${submission.status}`);
        }
        const existingScore = await this.finalScoreRepository.findOne({
            where: { submissionId },
        });
        if (existingScore) {
            this.logger.log(`Score already exists for submission: ${submissionId}`);
            return existingScore.scoreBreakdown;
        }
        const scoreBreakdown = this.performScoreCalculation(submission.formData);
        const finalScore = this.finalScoreRepository.create({
            submissionId,
            stateUt: submission.stateUt,
            totalScore: scoreBreakdown.totalScore,
            scoreBreakdown,
            calculationMethodology: scoreBreakdown.methodology,
            approvedBy: userId,
        });
        await this.finalScoreRepository.save(finalScore);
        this.logger.log(`Score calculated and saved for submission: ${submissionId}, Score: ${scoreBreakdown.totalScore}`);
        return scoreBreakdown;
    }
    performScoreCalculation(formData) {
        const calculations = [];
        let totalScore = 0;
        let maxPossibleScore = 0;
        const infraFinancingScore = this.calculateInfraFinancingScore(formData, calculations);
        totalScore += infraFinancingScore;
        maxPossibleScore += 250;
        const infraDevelopmentScore = this.calculateInfraDevelopmentScore(formData, calculations);
        totalScore += infraDevelopmentScore;
        maxPossibleScore += 250;
        const pppDevelopmentScore = this.calculatePPPDevelopmentScore(formData, calculations);
        totalScore += pppDevelopmentScore;
        maxPossibleScore += 250;
        const infraEnablersScore = this.calculateInfraEnablersScore(formData, calculations);
        totalScore += infraEnablersScore;
        maxPossibleScore += 250;
        const percentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
        return {
            totalScore: Math.round(totalScore * 100) / 100,
            maxPossibleScore,
            percentage: Math.round(percentage * 100) / 100,
            calculations,
            methodology: 'NIRI Scoring Methodology v2.0 - Based on detailed infrastructure readiness assessment rubric (1000 marks total)',
        };
    }
    calculateInfraFinancingScore(formData, calculations) {
        let categoryScore = 0;
        const section1_1 = formData.infraFinancing?.section1_1 || {};
        const capexAllocation = parseFloat(section1_1.capitalAllocation) || 0;
        const gsdp = parseFloat(section1_1.gsdpForFY) || 0;
        const capexToGsdpRatio = gsdp > 0 ? (capexAllocation / gsdp) * 100 : 0;
        const capexToGsdpScore = Math.min(capexToGsdpRatio * 0.5, 50);
        calculations.push({
            indicator: '1.1 % of Capex to GSDP',
            value: capexToGsdpRatio,
            weight: 0.05,
            score: capexToGsdpScore,
            maxScore: 50,
        });
        categoryScore += capexToGsdpScore;
        const section1_2 = formData.infraFinancing?.section1_2 || {};
        const actualCapex = parseFloat(section1_2.actualCapex) || 0;
        const stateCapexUtilisation = parseFloat(section1_2.stateCapexUtilisation) || 0;
        const capexUtilizationRatio = stateCapexUtilisation > 0 ? (actualCapex / stateCapexUtilisation) * 100 : 0;
        const capexUtilizationScore = Math.min(capexUtilizationRatio * 0.5, 50);
        calculations.push({
            indicator: '1.2 % Capex Utilization',
            value: capexUtilizationRatio,
            weight: 0.05,
            score: capexUtilizationScore,
            maxScore: 50,
        });
        categoryScore += capexUtilizationScore;
        const section1_3 = formData.infraFinancing?.section1_3 || [];
        const creditRatedULBs = section1_3.length;
        const totalULBs = 10;
        const creditRatedRatio = (creditRatedULBs / totalULBs) * 100;
        const creditRatedScore = Math.min(creditRatedRatio * 0.5, 50);
        calculations.push({
            indicator: '1.3 % of Credit Rated ULBs',
            value: creditRatedRatio,
            weight: 0.05,
            score: creditRatedScore,
            maxScore: 50,
        });
        categoryScore += creditRatedScore;
        const section1_4 = formData.infraFinancing?.section1_4 || [];
        const ulbsIssuingBonds = section1_4.length;
        const totalULBsEntered = 10;
        const ulbsBondsRatio = (ulbsIssuingBonds / totalULBsEntered) * 100;
        const ulbsBondsScore = Math.min(ulbsBondsRatio * 0.5, 50);
        calculations.push({
            indicator: '1.4 % of ULBs Issuing Bonds',
            value: ulbsBondsRatio,
            weight: 0.05,
            score: ulbsBondsScore,
            maxScore: 50,
        });
        categoryScore += ulbsBondsScore;
        const section1_5 = formData.infraFinancing?.section1_5 || [];
        const hasFinancialIntermediary = section1_5.length > 0;
        const financialIntermediaryScore = hasFinancialIntermediary ? 50 : 0;
        calculations.push({
            indicator: '1.5 Functional Financial Intermediary',
            value: hasFinancialIntermediary ? 1 : 0,
            weight: 0.05,
            score: financialIntermediaryScore,
            maxScore: 50,
        });
        categoryScore += financialIntermediaryScore;
        return categoryScore;
    }
    calculateInfraDevelopmentScore(formData, calculations) {
        let categoryScore = 0;
        const section2_1 = formData.infraDevelopment?.section2_1 || [];
        const hasInfraAct = section2_1.length > 0 && section2_1.some(item => item.files && item.files.length > 0);
        const infraActScore = hasInfraAct ? 50 : 0;
        calculations.push({
            indicator: '2.1 Availability of Infrastructure Act/Policy',
            value: hasInfraAct ? 1 : 0,
            weight: 0.05,
            score: infraActScore,
            maxScore: 50,
        });
        categoryScore += infraActScore;
        const section2_2 = formData.infraDevelopment?.section2_2 || [];
        const hasSpecializedEntity = section2_2.length > 0 && section2_2.some(item => item.files && item.files.length > 0);
        const specializedEntityScore = hasSpecializedEntity ? 50 : 0;
        calculations.push({
            indicator: '2.2 Availability of Specialized Entity',
            value: hasSpecializedEntity ? 1 : 0,
            weight: 0.05,
            score: specializedEntityScore,
            maxScore: 50,
        });
        categoryScore += specializedEntityScore;
        const section2_3 = formData.infraDevelopment?.section2_3 || [];
        const hasSectorPlan = section2_3.length > 0 && section2_3.some(item => item.files && item.files.length > 0);
        const sectorPlanScore = hasSectorPlan ? 50 : 0;
        calculations.push({
            indicator: '2.3 Sector Infra Development Plan',
            value: hasSectorPlan ? 1 : 0,
            weight: 0.05,
            score: sectorPlanScore,
            maxScore: 50,
        });
        categoryScore += sectorPlanScore;
        const section2_4 = formData.infraDevelopment?.section2_4 || [];
        const hasProjectPipeline = section2_4.length > 0 && section2_4.some(item => item.dprFile);
        const projectPipelineScore = hasProjectPipeline ? 50 : 0;
        calculations.push({
            indicator: '2.4 Investment Ready Project Pipeline',
            value: hasProjectPipeline ? 1 : 0,
            weight: 0.05,
            score: projectPipelineScore,
            maxScore: 50,
        });
        categoryScore += projectPipelineScore;
        const section2_5 = formData.infraDevelopment?.section2_5 || [];
        const hasAssetMonetization = section2_5.length > 0 && section2_5.some(item => item.projectName && item.estimatedMonetization);
        const assetMonetizationScore = hasAssetMonetization ? 50 : 0;
        calculations.push({
            indicator: '2.5 Asset Monetization Pipeline',
            value: hasAssetMonetization ? 1 : 0,
            weight: 0.05,
            score: assetMonetizationScore,
            maxScore: 50,
        });
        categoryScore += assetMonetizationScore;
        return categoryScore;
    }
    calculatePPPDevelopmentScore(formData, calculations) {
        let categoryScore = 0;
        const section3_1 = formData.pppDevelopment?.section3_1 || {};
        const hasPPPAct = section3_1.available === 'yes' || section3_1.available === 'Yes';
        const pppActScore = hasPPPAct ? 50 : 0;
        calculations.push({
            indicator: '3.1 Availability of PPP Act/Policy',
            value: hasPPPAct ? 1 : 0,
            weight: 0.05,
            score: pppActScore,
            maxScore: 50,
        });
        categoryScore += pppActScore;
        const section3_2 = formData.pppDevelopment?.section3_2 || {};
        const hasPPPCell = section3_2.available === 'yes' || section3_2.available === 'Yes';
        const pppCellScore = hasPPPCell ? 50 : 0;
        calculations.push({
            indicator: '3.2 Functional PPP Cell/Unit',
            value: hasPPPCell ? 1 : 0,
            weight: 0.05,
            score: pppCellScore,
            maxScore: 50,
        });
        categoryScore += pppCellScore;
        const section3_3 = formData.pppDevelopment?.section3_3 || [];
        const vgfProposals = section3_3.length;
        const vgfScore = Math.min(vgfProposals * 10, 50);
        calculations.push({
            indicator: '3.3 Proposals under VGF/IIPDF',
            value: vgfProposals,
            weight: 0.05,
            score: vgfScore,
            maxScore: 50,
        });
        categoryScore += vgfScore;
        const section3_4 = formData.pppDevelopment?.section3_4 || {};
        const proportion = parseFloat(section3_4.proportion) || 0;
        const tpcScore = Math.min(proportion * 0.27, 100);
        calculations.push({
            indicator: '3.4 Proportion of TPC of PPP Projects',
            value: proportion,
            weight: 0.1,
            score: tpcScore,
            maxScore: 100,
        });
        categoryScore += tpcScore;
        return categoryScore;
    }
    calculateInfraEnablersScore(formData, calculations) {
        let categoryScore = 0;
        const section4_1 = formData.infraEnablers?.section4_1 || {};
        const allEligible = section4_1.allEligible === 'yes' || section4_1.allEligible === 'Yes';
        const nipScore = allEligible ? 50 : 0;
        calculations.push({
            indicator: '4.1 All Eligible Infra Projects on NIP Portal',
            value: allEligible ? 1 : 0,
            weight: 0.05,
            score: nipScore,
            maxScore: 50,
        });
        categoryScore += nipScore;
        const section4_2 = formData.infraEnablers?.section4_2 || {};
        const hasPMG = section4_2.available === 'yes' || section4_2.available === 'Yes';
        const pmgScore = hasPMG ? 30 : 0;
        calculations.push({
            indicator: '4.2 Availability & Use of State/UT PMG',
            value: hasPMG ? 1 : 0,
            weight: 0.03,
            score: pmgScore,
            maxScore: 30,
        });
        categoryScore += pmgScore;
        const section4_3 = formData.infraEnablers?.section4_3 || {};
        const numberOfProjects = parseFloat(section4_3.numberOfProjects) || 0;
        const gatiShaktiScore = Math.min(numberOfProjects * 10, 20);
        calculations.push({
            indicator: '4.3 Adoption of PM GatiShakti',
            value: numberOfProjects,
            weight: 0.02,
            score: gatiShaktiScore,
            maxScore: 20,
        });
        categoryScore += gatiShaktiScore;
        const section4_4 = formData.infraEnablers?.section4_4 || {};
        const adoptedADR = section4_4.adopted === 'yes' || section4_4.adopted === 'Yes';
        const adrScore = adoptedADR ? 50 : 0;
        calculations.push({
            indicator: '4.4 Adoption of ADR',
            value: adoptedADR ? 1 : 0,
            weight: 0.05,
            score: adrScore,
            maxScore: 50,
        });
        categoryScore += adrScore;
        const section4_5 = formData.infraEnablers?.section4_5 || {};
        const hasInnovativePractice = section4_5.implemented === 'yes' || section4_5.implemented === 'Yes';
        const innovativeScore = hasInnovativePractice ? 50 : 0;
        calculations.push({
            indicator: '4.5 Innovative Practices',
            value: hasInnovativePractice ? 1 : 0,
            weight: 0.05,
            score: innovativeScore,
            maxScore: 50,
        });
        categoryScore += innovativeScore;
        const section4_6 = formData.infraEnablers?.section4_6 || [];
        const participants = section4_6.length;
        const capacityScore = Math.min(participants * 10, 50);
        calculations.push({
            indicator: '4.6 Capacity Building - Officer Participation',
            value: participants,
            weight: 0.05,
            score: capacityScore,
            maxScore: 50,
        });
        categoryScore += capacityScore;
        return categoryScore;
    }
    async getScoreRankings() {
        const scores = await this.finalScoreRepository
            .createQueryBuilder('fs')
            .leftJoinAndSelect('fs.submission', 's')
            .select([
            'fs.id',
            'fs.submissionId',
            'fs.stateUt',
            'fs.totalScore',
            'fs.percentage',
            'fs.createdAt',
            's.formData',
        ])
            .orderBy('fs.totalScore', 'DESC')
            .getMany();
        return scores.map((score, index) => ({
            rank: index + 1,
            stateUt: score.stateUt,
            totalScore: score.totalScore,
            percentage: score.percentage,
            submissionId: score.submissionId,
            createdAt: score.createdAt,
        }));
    }
    async getScoreStatistics() {
        const scores = await this.finalScoreRepository.find();
        if (scores.length === 0) {
            return {
                totalSubmissions: 0,
                averageScore: 0,
                highestScore: 0,
                lowestScore: 0,
                scoreDistribution: {},
            };
        }
        const totalScores = scores.map(s => s.totalScore);
        const averageScore = totalScores.reduce((sum, score) => sum + score, 0) / totalScores.length;
        const highestScore = Math.max(...totalScores);
        const lowestScore = Math.min(...totalScores);
        const distribution = {
            '0-200': 0,
            '201-400': 0,
            '401-600': 0,
            '601-800': 0,
            '801-1000': 0,
        };
        totalScores.forEach(score => {
            if (score <= 200)
                distribution['0-200']++;
            else if (score <= 400)
                distribution['201-400']++;
            else if (score <= 600)
                distribution['401-600']++;
            else if (score <= 800)
                distribution['601-800']++;
            else
                distribution['801-1000']++;
        });
        return {
            totalSubmissions: scores.length,
            averageScore: Math.round(averageScore * 100) / 100,
            highestScore,
            lowestScore,
            scoreDistribution: distribution,
        };
    }
    async getStateScore(stateUt) {
        const score = await this.finalScoreRepository.findOne({
            where: { stateUt },
            order: { createdAt: 'DESC' },
        });
        if (!score) {
            throw new common_1.NotFoundException(`No score found for state: ${stateUt}`);
        }
        return {
            stateUt: score.stateUt,
            totalScore: score.totalScore,
            percentage: score.percentage,
            scoreBreakdown: score.scoreBreakdown,
            calculationMethodology: score.calculationMethodology,
            createdAt: score.createdAt,
        };
    }
    async getAllScores(page = 1, limit = 10) {
        const [scores, total] = await this.finalScoreRepository.findAndCount({
            order: { totalScore: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });
        return {
            scores: scores.map(score => ({
                id: score.id,
                submissionId: score.submissionId,
                stateUt: score.stateUt,
                totalScore: score.totalScore,
                percentage: score.percentage,
                createdAt: score.createdAt,
            })),
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }
};
exports.ScoringService = ScoringService;
exports.ScoringService = ScoringService = ScoringService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(submission_entity_1.Submission)),
    __param(1, (0, typeorm_1.InjectRepository)(final_score_entity_1.FinalScore)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], ScoringService);
//# sourceMappingURL=scoring.service.js.map