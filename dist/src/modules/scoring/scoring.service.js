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
        const capexAllocation = formData.capexAllocation || 0;
        const gsdp = formData.gsdp || 0;
        const capexToGsdpRatio = gsdp > 0 ? (capexAllocation / gsdp) * 100 : 0;
        const capexToGsdpScore = Math.min(capexToGsdpRatio * 10, 50);
        calculations.push({
            indicator: '1.1 % of Capex to GSDP',
            value: capexToGsdpRatio,
            weight: 0.05,
            score: capexToGsdpScore,
            maxScore: 50,
        });
        categoryScore += capexToGsdpScore;
        const actualCapex = formData.actualCapex || 0;
        const stateCapexUtilisation = formData.stateCapexUtilisation || 0;
        const capexUtilizationRatio = stateCapexUtilisation > 0 ? (actualCapex / stateCapexUtilisation) * 100 : 0;
        const capexUtilizationScore = Math.min(capexUtilizationRatio + 2, 50);
        calculations.push({
            indicator: '1.2 % Capex Utilization',
            value: capexUtilizationRatio,
            weight: 0.05,
            score: capexUtilizationScore,
            maxScore: 50,
        });
        categoryScore += capexUtilizationScore;
        const creditRatedULBs = formData.creditRatedULBs || 0;
        const totalULBs = formData.totalULBs || 0;
        const creditRatedRatio = totalULBs > 0 ? (creditRatedULBs / totalULBs) * 100 : 0;
        const creditRatedScore = Math.min(creditRatedRatio + 2, 50);
        calculations.push({
            indicator: '1.3 % of Credit Rated ULBs',
            value: creditRatedRatio,
            weight: 0.05,
            score: creditRatedScore,
            maxScore: 50,
        });
        categoryScore += creditRatedScore;
        const ulbsApprovedByMoSPI = formData.ulbsApprovedByMoSPI || 0;
        const totalULBsEntered = formData.totalULBsEntered || 0;
        const ulbsBondsRatio = totalULBsEntered > 0 ? (ulbsApprovedByMoSPI / totalULBsEntered) * 100 : 0;
        const ulbsBondsScore = Math.min(ulbsBondsRatio * 2, 50);
        calculations.push({
            indicator: '1.4 % of ULBs Issuing Bonds',
            value: ulbsBondsRatio,
            weight: 0.05,
            score: ulbsBondsScore,
            maxScore: 50,
        });
        categoryScore += ulbsBondsScore;
        const hasFinancialIntermediary = formData.hasFinancialIntermediary === 'Yes' &&
            formData.financialIntermediaryDocUploaded === true;
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
        const infraActSectors = formData.infraActSectors || [];
        const hasOverarchingAct = formData.hasOverarchingAct === 'Overarching';
        const infraActDocUploaded = formData.infraActDocUploaded === true;
        let infraActScore = 0;
        if (hasOverarchingAct && infraActDocUploaded) {
            infraActScore = 50;
        }
        else {
            const sectorsWithDocs = infraActSectors.filter(sector => sector.docUploaded).length;
            infraActScore = Math.min(sectorsWithDocs * 10, 50);
        }
        calculations.push({
            indicator: '2.1 Availability of Infrastructure Act/Policy',
            value: infraActSectors.length,
            weight: 0.05,
            score: infraActScore,
            maxScore: 50,
        });
        categoryScore += infraActScore;
        const specializedEntitySectors = formData.specializedEntitySectors || [];
        const sectorsWithDocs = specializedEntitySectors.filter(sector => sector.docUploaded).length;
        const specializedEntityScore = Math.min(sectorsWithDocs * 10, 50);
        calculations.push({
            indicator: '2.2 Availability of Specialized Entity',
            value: sectorsWithDocs,
            weight: 0.05,
            score: specializedEntityScore,
            maxScore: 50,
        });
        categoryScore += specializedEntityScore;
        const sectorPlanSectors = formData.sectorPlanSectors || [];
        const hasOverarchingPlan = formData.hasOverarchingPlan === 'Overarching';
        const sectorPlanDocUploaded = formData.sectorPlanDocUploaded === true;
        let sectorPlanScore = 0;
        if (hasOverarchingPlan && sectorPlanDocUploaded) {
            sectorPlanScore = 50;
        }
        else {
            const sectorsWithDocs = sectorPlanSectors.filter(sector => sector.docUploaded).length;
            sectorPlanScore = Math.min(sectorsWithDocs * 10, 50);
        }
        calculations.push({
            indicator: '2.3 Sector Infra Development Plan',
            value: sectorPlanSectors.length,
            weight: 0.05,
            score: sectorPlanScore,
            maxScore: 50,
        });
        categoryScore += sectorPlanScore;
        const investmentProjects = formData.investmentProjects || [];
        const validProjects = investmentProjects.filter(project => project.docUploaded).length;
        const investmentProjectsScore = Math.min(validProjects * 10, 50);
        calculations.push({
            indicator: '2.4 Investment Ready Project Pipeline',
            value: validProjects,
            weight: 0.05,
            score: investmentProjectsScore,
            maxScore: 50,
        });
        categoryScore += investmentProjectsScore;
        const assetMonetizationProjects = formData.assetMonetizationProjects || [];
        const validAssets = assetMonetizationProjects.filter(asset => asset.docUploaded).length;
        const assetMonetizationScore = Math.min(validAssets * 10, 50);
        calculations.push({
            indicator: '2.5 Asset Monetization Pipeline',
            value: validAssets,
            weight: 0.05,
            score: assetMonetizationScore,
            maxScore: 50,
        });
        categoryScore += assetMonetizationScore;
        return categoryScore;
    }
    calculatePPPDevelopmentScore(formData, calculations) {
        let categoryScore = 0;
        const hasPPPAct = formData.hasPPPAct === 'Yes';
        const pppActDocUploaded = formData.pppActDocUploaded === true;
        const pppActScore = (hasPPPAct && pppActDocUploaded) ? 50 : 0;
        calculations.push({
            indicator: '3.1 Availability of PPP Act/Policy',
            value: hasPPPAct ? 1 : 0,
            weight: 0.05,
            score: pppActScore,
            maxScore: 50,
        });
        categoryScore += pppActScore;
        const hasPPPCell = formData.hasPPPCell === 'Yes';
        const pppCellDocUploaded = formData.pppCellDocUploaded === true;
        const pppCellScore = (hasPPPCell && pppCellDocUploaded) ? 50 : 0;
        calculations.push({
            indicator: '3.2 Functional PPP Cell/Unit',
            value: hasPPPCell ? 1 : 0,
            weight: 0.05,
            score: pppCellScore,
            maxScore: 50,
        });
        categoryScore += pppCellScore;
        const vgfProjects = formData.vgfProjects || [];
        const validVGFProjects = vgfProjects.filter(project => project.docUploaded).length;
        const vgfScore = Math.min(validVGFProjects * 5, 50);
        calculations.push({
            indicator: '3.3 Proposals under VGF/IIPDF',
            value: validVGFProjects,
            weight: 0.05,
            score: vgfScore,
            maxScore: 50,
        });
        categoryScore += vgfScore;
        const totalCostBankablePPP = formData.totalCostBankablePPP || 0;
        const totalCostAllInfraProjects = formData.totalCostAllInfraProjects || 0;
        const pppProportionRatio = totalCostAllInfraProjects > 0 ? (totalCostBankablePPP / totalCostAllInfraProjects) * 100 : 0;
        const pppProportionScore = Math.min(pppProportionRatio * 2, 100);
        calculations.push({
            indicator: '3.4 Proportion of TPC of PPP Projects',
            value: pppProportionRatio,
            weight: 0.1,
            score: pppProportionScore,
            maxScore: 100,
        });
        categoryScore += pppProportionScore;
        return categoryScore;
    }
    calculateInfraEnablersScore(formData, calculations) {
        let categoryScore = 0;
        const allProjectsOnNIP = formData.allProjectsOnNIP === 'Yes';
        const nipDocUploaded = formData.nipDocUploaded === true;
        const nipScore = (allProjectsOnNIP && nipDocUploaded) ? 50 : 0;
        calculations.push({
            indicator: '4.1 All Eligible Infra Projects on NIP Portal',
            value: allProjectsOnNIP ? 1 : 0,
            weight: 0.05,
            score: nipScore,
            maxScore: 50,
        });
        categoryScore += nipScore;
        const hasStatePMG = formData.hasStatePMG === 'Yes';
        const pmgDocOrURLUploaded = formData.pmgDocOrURLUploaded === true;
        const pmgScore = (hasStatePMG && pmgDocOrURLUploaded) ? 30 : 0;
        calculations.push({
            indicator: '4.2 Availability & Use of State/UT PMG',
            value: hasStatePMG ? 1 : 0,
            weight: 0.03,
            score: pmgScore,
            maxScore: 30,
        });
        categoryScore += pmgScore;
        const gatiShaktiProjects = formData.gatiShaktiProjects || [];
        const validGatiShaktiProjects = gatiShaktiProjects.filter(project => project.evidenceUploaded).length;
        const gatiShaktiScore = Math.min(validGatiShaktiProjects * 5, 20);
        calculations.push({
            indicator: '4.3 Adoption of PM GatiShakti',
            value: validGatiShaktiProjects,
            weight: 0.02,
            score: gatiShaktiScore,
            maxScore: 20,
        });
        categoryScore += gatiShaktiScore;
        const hasADR = formData.hasADR === 'Yes';
        const adrDocUploaded = formData.adrDocUploaded === true;
        const adrScore = (hasADR && adrDocUploaded) ? 50 : 0;
        calculations.push({
            indicator: '4.4 Adoption of ADR',
            value: hasADR ? 1 : 0,
            weight: 0.05,
            score: adrScore,
            maxScore: 50,
        });
        categoryScore += adrScore;
        const innovativePractices = formData.innovativePractices || [];
        const validPractices = innovativePractices.filter(practice => practice.evidenceUploaded).length;
        const innovativeScore = Math.min(validPractices * 10, 50);
        calculations.push({
            indicator: '4.5 Innovative Practices',
            value: validPractices,
            weight: 0.05,
            score: innovativeScore,
            maxScore: 50,
        });
        categoryScore += innovativeScore;
        const capacityBuildingOfficers = formData.capacityBuildingOfficers || [];
        const validOfficers = capacityBuildingOfficers.filter(officer => officer.name && officer.designation && officer.participationDate).length;
        const capacityBuildingScore = Math.min(validOfficers * 1, 50);
        calculations.push({
            indicator: '4.6 Capacity Building - Officer Participation',
            value: validOfficers,
            weight: 0.05,
            score: capacityBuildingScore,
            maxScore: 50,
        });
        categoryScore += capacityBuildingScore;
        return categoryScore;
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