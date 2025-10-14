import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Submission, SubmissionStatus } from '../../entities/submission.entity';
import { FinalScore } from '../../entities/final-score.entity';

export interface ScoreCalculation {
  indicator: string;
  value: number;
  weight: number;
  score: number;
  maxScore: number;
}

export interface ScoreBreakdown {
  totalScore: number;
  maxPossibleScore: number;
  percentage: number;
  calculations: ScoreCalculation[];
  methodology: string;
}

@Injectable()
export class ScoringService {
  constructor(
    @InjectRepository(Submission)
    private submissionRepository: Repository<Submission>,
    @InjectRepository(FinalScore)
    private finalScoreRepository: Repository<FinalScore>,
  ) {}

  async calculateScore(submissionId: string, approvedBy: string): Promise<FinalScore> {
    // Validate UUID format
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

    if (submission.status !== SubmissionStatus.APPROVED) {
      throw new Error(
        `Can only calculate score for approved submissions. Current status: ${submission.status}`,
      );
    }

    // Check if score already exists
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

  private performScoreCalculation(formData: Record<string, any>): ScoreBreakdown {
    const calculations: ScoreCalculation[] = [];
    let totalScore = 0;
    let maxPossibleScore = 0;

    // NIRI Scoring Methodology based on detailed rubric (Total: 1000 marks)
    
    // 1. INFRA FINANCING (250 marks)
    const infraFinancingScore = this.calculateInfraFinancingScore(formData, calculations);
    totalScore += infraFinancingScore;
    maxPossibleScore += 250;

    // 2. INFRA DEVELOPMENT (250 marks)
    const infraDevelopmentScore = this.calculateInfraDevelopmentScore(formData, calculations);
    totalScore += infraDevelopmentScore;
    maxPossibleScore += 250;

    // 3. PPP DEVELOPMENT (250 marks)
    const pppDevelopmentScore = this.calculatePPPDevelopmentScore(formData, calculations);
    totalScore += pppDevelopmentScore;
    maxPossibleScore += 250;

    // 4. INFRA ENABLERS (250 marks)
    const infraEnablersScore = this.calculateInfraEnablersScore(formData, calculations);
    totalScore += infraEnablersScore;
    maxPossibleScore += 250;

    const percentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;

    return {
      totalScore: Math.round(totalScore * 100) / 100,
      maxPossibleScore,
      percentage: Math.round(percentage * 100) / 100,
      calculations,
      methodology:
        'NIRI Scoring Methodology v2.0 - Based on detailed infrastructure readiness assessment rubric (1000 marks total)',
    };
  }

  // 1. INFRA FINANCING CALCULATIONS (250 marks)
  private calculateInfraFinancingScore(formData: Record<string, any>, calculations: ScoreCalculation[]): number {
    let categoryScore = 0;

    // 1.1 % of Capex to GSDP (50 marks)
    const capexAllocation = formData.capexAllocation || 0;
    const gsdp = formData.gsdp || 0;
    const capexToGsdpRatio = gsdp > 0 ? (capexAllocation / gsdp) * 100 : 0;
    const capexToGsdpScore = Math.min(capexToGsdpRatio * 10, 50); // 10 marks for every 1%
    
    calculations.push({
      indicator: '1.1 % of Capex to GSDP',
      value: capexToGsdpRatio,
      weight: 0.05,
      score: capexToGsdpScore,
      maxScore: 50,
    });
    categoryScore += capexToGsdpScore;

    // 1.2 % Capex Utilization (50 marks)
    const actualCapex = formData.actualCapex || 0;
    const stateCapexUtilisation = formData.stateCapexUtilisation || 0;
    const capexUtilizationRatio = stateCapexUtilisation > 0 ? (actualCapex / stateCapexUtilisation) * 100 : 0;
    const capexUtilizationScore = Math.min(capexUtilizationRatio + 2, 50); // 1 mark for every 2%
    
    calculations.push({
      indicator: '1.2 % Capex Utilization',
      value: capexUtilizationRatio,
      weight: 0.05,
      score: capexUtilizationScore,
      maxScore: 50,
    });
    categoryScore += capexUtilizationScore;

    // 1.3 % of Credit Rated ULBs (50 marks)
    const creditRatedULBs = formData.creditRatedULBs || 0;
    const totalULBs = formData.totalULBs || 0;
    const creditRatedRatio = totalULBs > 0 ? (creditRatedULBs / totalULBs) * 100 : 0;
    const creditRatedScore = Math.min(creditRatedRatio + 2, 50); // 1 mark for every 2%
    
    calculations.push({
      indicator: '1.3 % of Credit Rated ULBs',
      value: creditRatedRatio,
      weight: 0.05,
      score: creditRatedScore,
      maxScore: 50,
    });
    categoryScore += creditRatedScore;

    // 1.4 % of ULBs Issuing Bonds (50 marks)
    const ulbsApprovedByMoSPI = formData.ulbsApprovedByMoSPI || 0;
    const totalULBsEntered = formData.totalULBsEntered || 0;
    const ulbsBondsRatio = totalULBsEntered > 0 ? (ulbsApprovedByMoSPI / totalULBsEntered) * 100 : 0;
    const ulbsBondsScore = Math.min(ulbsBondsRatio * 2, 50); // 2 marks for every 1%
    
    calculations.push({
      indicator: '1.4 % of ULBs Issuing Bonds',
      value: ulbsBondsRatio,
      weight: 0.05,
      score: ulbsBondsScore,
      maxScore: 50,
    });
    categoryScore += ulbsBondsScore;

    // 1.5 Functional Financial Intermediary (50 marks)
    const hasFinancialIntermediary = formData.hasFinancialIntermediary === 'Yes' && 
                                   formData.financialIntermediaryDocUploaded === true;
    const financialIntermediaryScore = hasFinancialIntermediary ? 50 : 0; // Binary: Yes = 50, No = 0
    
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

  // 2. INFRA DEVELOPMENT CALCULATIONS (250 marks)
  private calculateInfraDevelopmentScore(formData: Record<string, any>, calculations: ScoreCalculation[]): number {
    let categoryScore = 0;

    // 2.1 Availability of Infrastructure Act/Policy (50 marks)
    const infraActSectors = formData.infraActSectors || [];
    const hasOverarchingAct = formData.hasOverarchingAct === 'Overarching';
    const infraActDocUploaded = formData.infraActDocUploaded === true;
    
    let infraActScore = 0;
    if (hasOverarchingAct && infraActDocUploaded) {
      infraActScore = 50;
    } else {
      const sectorsWithDocs = infraActSectors.filter(sector => sector.docUploaded).length;
      infraActScore = Math.min(sectorsWithDocs * 10, 50); // 10 marks per valid sector
    }
    
    calculations.push({
      indicator: '2.1 Availability of Infrastructure Act/Policy',
      value: infraActSectors.length,
      weight: 0.05,
      score: infraActScore,
      maxScore: 50,
    });
    categoryScore += infraActScore;

    // 2.2 Availability of Specialized Entity (50 marks)
    const specializedEntitySectors = formData.specializedEntitySectors || [];
    const sectorsWithDocs = specializedEntitySectors.filter(sector => sector.docUploaded).length;
    const specializedEntityScore = Math.min(sectorsWithDocs * 10, 50); // 10 marks per sector with doc
    
    calculations.push({
      indicator: '2.2 Availability of Specialized Entity',
      value: sectorsWithDocs,
      weight: 0.05,
      score: specializedEntityScore,
      maxScore: 50,
    });
    categoryScore += specializedEntityScore;

    // 2.3 Sector Infra Development Plan (50 marks)
    const sectorPlanSectors = formData.sectorPlanSectors || [];
    const hasOverarchingPlan = formData.hasOverarchingPlan === 'Overarching';
    const sectorPlanDocUploaded = formData.sectorPlanDocUploaded === true;
    
    let sectorPlanScore = 0;
    if (hasOverarchingPlan && sectorPlanDocUploaded) {
      sectorPlanScore = 50;
    } else {
      const sectorsWithDocs = sectorPlanSectors.filter(sector => sector.docUploaded).length;
      sectorPlanScore = Math.min(sectorsWithDocs * 10, 50); // 10 marks per valid sector
    }
    
    calculations.push({
      indicator: '2.3 Sector Infra Development Plan',
      value: sectorPlanSectors.length,
      weight: 0.05,
      score: sectorPlanScore,
      maxScore: 50,
    });
    categoryScore += sectorPlanScore;

    // 2.4 Investment Ready Project Pipeline (50 marks)
    const investmentProjects = formData.investmentProjects || [];
    const validProjects = investmentProjects.filter(project => project.docUploaded).length;
    const investmentProjectsScore = Math.min(validProjects * 10, 50); // 10 marks per project
    
    calculations.push({
      indicator: '2.4 Investment Ready Project Pipeline',
      value: validProjects,
      weight: 0.05,
      score: investmentProjectsScore,
      maxScore: 50,
    });
    categoryScore += investmentProjectsScore;

    // 2.5 Asset Monetization Pipeline (50 marks)
    const assetMonetizationProjects = formData.assetMonetizationProjects || [];
    const validAssets = assetMonetizationProjects.filter(asset => asset.docUploaded).length;
    const assetMonetizationScore = Math.min(validAssets * 10, 50); // 10 marks per asset/project
    
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

  // 3. PPP DEVELOPMENT CALCULATIONS (250 marks)
  private calculatePPPDevelopmentScore(formData: Record<string, any>, calculations: ScoreCalculation[]): number {
    let categoryScore = 0;

    // 3.1 Availability of PPP Act/Policy (50 marks)
    const hasPPPAct = formData.hasPPPAct === 'Yes';
    const pppActDocUploaded = formData.pppActDocUploaded === true;
    const pppActScore = (hasPPPAct && pppActDocUploaded) ? 50 : 0; // Binary: Yes + Doc = 50, else 0
    
    calculations.push({
      indicator: '3.1 Availability of PPP Act/Policy',
      value: hasPPPAct ? 1 : 0,
      weight: 0.05,
      score: pppActScore,
      maxScore: 50,
    });
    categoryScore += pppActScore;

    // 3.2 Functional PPP Cell/Unit (50 marks)
    const hasPPPCell = formData.hasPPPCell === 'Yes';
    const pppCellDocUploaded = formData.pppCellDocUploaded === true;
    const pppCellScore = (hasPPPCell && pppCellDocUploaded) ? 50 : 0; // Binary: Yes + Doc = 50, else 0
    
    calculations.push({
      indicator: '3.2 Functional PPP Cell/Unit',
      value: hasPPPCell ? 1 : 0,
      weight: 0.05,
      score: pppCellScore,
      maxScore: 50,
    });
    categoryScore += pppCellScore;

    // 3.3 Proposals under VGF/IIPDF (50 marks)
    const vgfProjects = formData.vgfProjects || [];
    const validVGFProjects = vgfProjects.filter(project => project.docUploaded).length;
    const vgfScore = Math.min(validVGFProjects * 5, 50); // 5 marks per project
    
    calculations.push({
      indicator: '3.3 Proposals under VGF/IIPDF',
      value: validVGFProjects,
      weight: 0.05,
      score: vgfScore,
      maxScore: 50,
    });
    categoryScore += vgfScore;

    // 3.4 Proportion of TPC of PPP Projects (100 marks)
    const totalCostBankablePPP = formData.totalCostBankablePPP || 0;
    const totalCostAllInfraProjects = formData.totalCostAllInfraProjects || 0;
    const pppProportionRatio = totalCostAllInfraProjects > 0 ? (totalCostBankablePPP / totalCostAllInfraProjects) * 100 : 0;
    const pppProportionScore = Math.min(pppProportionRatio * 2, 100); // 2 marks per 1%
    
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

  // 4. INFRA ENABLERS CALCULATIONS (250 marks)
  private calculateInfraEnablersScore(formData: Record<string, any>, calculations: ScoreCalculation[]): number {
    let categoryScore = 0;

    // 4.1 All Eligible Infra Projects on NIP Portal (50 marks)
    const allProjectsOnNIP = formData.allProjectsOnNIP === 'Yes';
    const nipDocUploaded = formData.nipDocUploaded === true;
    const nipScore = (allProjectsOnNIP && nipDocUploaded) ? 50 : 0; // Binary: Yes + Doc = 50, else 0
    
    calculations.push({
      indicator: '4.1 All Eligible Infra Projects on NIP Portal',
      value: allProjectsOnNIP ? 1 : 0,
      weight: 0.05,
      score: nipScore,
      maxScore: 50,
    });
    categoryScore += nipScore;

    // 4.2 Availability & Use of State/UT PMG (30 marks)
    const hasStatePMG = formData.hasStatePMG === 'Yes';
    const pmgDocOrURLUploaded = formData.pmgDocOrURLUploaded === true;
    const pmgScore = (hasStatePMG && pmgDocOrURLUploaded) ? 30 : 0; // Binary: Yes + Upload = 30, else 0
    
    calculations.push({
      indicator: '4.2 Availability & Use of State/UT PMG',
      value: hasStatePMG ? 1 : 0,
      weight: 0.03,
      score: pmgScore,
      maxScore: 30,
    });
    categoryScore += pmgScore;

    // 4.3 Adoption of PM GatiShakti (20 marks)
    const gatiShaktiProjects = formData.gatiShaktiProjects || [];
    const validGatiShaktiProjects = gatiShaktiProjects.filter(project => project.evidenceUploaded).length;
    const gatiShaktiScore = Math.min(validGatiShaktiProjects * 5, 20); // 5 marks per project, capped at 20
    
    calculations.push({
      indicator: '4.3 Adoption of PM GatiShakti',
      value: validGatiShaktiProjects,
      weight: 0.02,
      score: gatiShaktiScore,
      maxScore: 20,
    });
    categoryScore += gatiShaktiScore;

    // 4.4 Adoption of ADR (50 marks)
    const hasADR = formData.hasADR === 'Yes';
    const adrDocUploaded = formData.adrDocUploaded === true;
    const adrScore = (hasADR && adrDocUploaded) ? 50 : 0; // Binary: Yes + Doc = 50, else 0
    
    calculations.push({
      indicator: '4.4 Adoption of ADR',
      value: hasADR ? 1 : 0,
      weight: 0.05,
      score: adrScore,
      maxScore: 50,
    });
    categoryScore += adrScore;

    // 4.5 Innovative Practices (50 marks)
    const innovativePractices = formData.innovativePractices || [];
    const validPractices = innovativePractices.filter(practice => practice.evidenceUploaded).length;
    const innovativeScore = Math.min(validPractices * 10, 50); // 10 marks per practice, capped at 50
    
    calculations.push({
      indicator: '4.5 Innovative Practices',
      value: validPractices,
      weight: 0.05,
      score: innovativeScore,
      maxScore: 50,
    });
    categoryScore += innovativeScore;

    // 4.6 Capacity Building - Officer Participation (50 marks)
    const capacityBuildingOfficers = formData.capacityBuildingOfficers || [];
    const validOfficers = capacityBuildingOfficers.filter(officer => 
      officer.name && officer.designation && officer.participationDate
    ).length;
    const capacityBuildingScore = Math.min(validOfficers * 1, 50); // 1 mark per officer, capped at 50
    
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

  async getScoreRankings(): Promise<any[]> {
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

  async getStateScore(stateUt: string): Promise<FinalScore | null> {
    return this.finalScoreRepository.findOne({
      where: { stateUt },
      relations: ['submission'],
      order: { createdAt: 'DESC' },
    });
  }

  async getScoreStatistics(): Promise<any> {
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

    // Score distribution
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
}
