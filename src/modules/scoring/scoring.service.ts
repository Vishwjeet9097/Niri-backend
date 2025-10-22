import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Submission } from '../../entities/submission.entity';
import { FinalScore } from '../../entities/final-score.entity';
import { UserRole } from '../../entities/user.entity';

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
  categoryScores?: {
    infraFinancing: {
      score: number;
      maxScore: number;
      percentage: number;
    };
    infraDevelopment: {
      score: number;
      maxScore: number;
      percentage: number;
    };
    pppDevelopment: {
      score: number;
      maxScore: number;
      percentage: number;
    };
    infraEnablers: {
      score: number;
      maxScore: number;
      percentage: number;
    };
  };
  methodology: string;
}

export interface CategoryScore {
  category: string;
  score: number;
  maxScore: number;
  percentage: number;
}

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(
    @InjectRepository(Submission)
    private submissionRepository: Repository<Submission>,
    @InjectRepository(FinalScore)
    private finalScoreRepository: Repository<FinalScore>,
  ) {}

  async calculateScore(submissionId: string, userId: string): Promise<ScoreBreakdown> {
    this.logger.log(`Calculating score for submission: ${submissionId}`);

    // Step 1: Get submission with form data
    const submission = await this.submissionRepository.findOne({
      where: { id: submissionId },
    });

    if (!submission) {
      throw new NotFoundException(`Submission with ID ${submissionId} not found`);
    }

    if (submission.status !== 'APPROVED') {
      throw new Error(`Submission must be APPROVED to calculate score. Current status: ${submission.status}`);
    }

    // Step 2: Check if score already exists
    const existingScore = await this.finalScoreRepository.findOne({
      where: { submissionId },
    });

    if (existingScore) {
      this.logger.log(`Score already exists for submission: ${submissionId}`);
      return existingScore.scoreBreakdown as ScoreBreakdown;
    }

    // Step 3: Calculate score based on form data
    const scoreBreakdown = this.performScoreCalculation(submission.formData);

    // Step 4: Save score to database
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
      categoryScores: {
        infraFinancing: {
          score: infraFinancingScore,
          maxScore: 250,
          percentage: Math.round((infraFinancingScore / 250) * 100 * 100) / 100
        },
        infraDevelopment: {
          score: infraDevelopmentScore,
          maxScore: 250,
          percentage: Math.round((infraDevelopmentScore / 250) * 100 * 100) / 100
        },
        pppDevelopment: {
          score: pppDevelopmentScore,
          maxScore: 250,
          percentage: Math.round((pppDevelopmentScore / 250) * 100 * 100) / 100
        },
        infraEnablers: {
          score: infraEnablersScore,
          maxScore: 250,
          percentage: Math.round((infraEnablersScore / 250) * 100 * 100) / 100
        }
      },
      methodology:
        'NIRI Scoring Methodology v2.0 - Based on detailed infrastructure readiness assessment rubric (1000 marks total)',
    };
  }

  // 1. INFRA FINANCING CALCULATIONS (250 marks)
  private calculateInfraFinancingScore(formData: Record<string, any>, calculations: ScoreCalculation[]): number {
    let categoryScore = 0;

    // 1.1 % of Capex to GSDP (50 marks)
    const section1_1 = formData.infraFinancing?.section1_1 || {};
    const capexAllocation = parseFloat(section1_1.capitalAllocation) || 0;
    const gsdp = parseFloat(section1_1.gsdpForFY) || 0;
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
    const section1_2 = formData.infraFinancing?.section1_2 || {};
    const actualCapex = parseFloat(section1_2.actualCapex) || 0;
    const stateCapexUtilisation = parseFloat(section1_2.stateCapexUtilisation) || 0;
    const capexUtilizationRatio = stateCapexUtilisation > 0 ? (actualCapex / stateCapexUtilisation) * 100 : 0;
    const capexUtilizationScore = Math.min(capexUtilizationRatio / 2, 50); // 1 mark for every 2%
    
    calculations.push({
      indicator: '1.2 % Capex Utilization',
      value: capexUtilizationRatio,
      weight: 0.05,
      score: capexUtilizationScore,
      maxScore: 50,
    });
    categoryScore += capexUtilizationScore;

    // 1.3 % of Credit Rated ULBs (50 marks)
    const section1_3 = formData.infraFinancing?.section1_3 || [];
    const creditRatedULBs = section1_3.length;
    const totalULBs = 10; // Assuming total ULBs as 10 for realistic calculation
    const creditRatedRatio = (creditRatedULBs / totalULBs) * 100;
    const creditRatedScore = Math.min(creditRatedRatio / 2, 50); // 1 mark for every 2%
    
    calculations.push({
      indicator: '1.3 % of Credit Rated ULBs',
      value: creditRatedRatio,
      weight: 0.05,
      score: creditRatedScore,
      maxScore: 50,
    });
    categoryScore += creditRatedScore;

    // 1.4 % of ULBs Issuing Bonds (50 marks)
    const section1_4 = formData.infraFinancing?.section1_4 || [];
    const ulbsIssuingBonds = section1_4.length;
    const totalULBsEntered = 10; // Assuming total ULBs as 10 for realistic calculation
    const ulbsBondsRatio = (ulbsIssuingBonds / totalULBsEntered) * 100;
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
    const section1_5 = formData.infraFinancing?.section1_5 || [];
    const validEntries = section1_5.length;
    const financialIntermediaryScore = Math.min(validEntries * 10, 50); // 10 marks per entry
    
    calculations.push({
      indicator: '1.5 Functional Financial Intermediary',
      value: validEntries,
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
    const section2_1 = formData.infraDevelopment?.section2_1 || [];
    const sectorsWithDoc2_1 = section2_1.filter(item => item.files && item.files.length > 0).length;
    const infraActScore = Math.min(sectorsWithDoc2_1 * 10, 50); // 10 marks per sector with document
    
    calculations.push({
      indicator: '2.1 Availability of Infrastructure Act/Policy',
      value: sectorsWithDoc2_1,
      weight: 0.05,
      score: infraActScore,
      maxScore: 50,
    });
    categoryScore += infraActScore;

    // 2.2 Availability of Specialized Entity (50 marks)
    const section2_2 = formData.infraDevelopment?.section2_2 || [];
    const sectorsWithDoc2_2 = section2_2.filter(item => item.files && item.files.length > 0).length;
    const specializedEntityScore = Math.min(sectorsWithDoc2_2 * 10, 50); // 10 marks per sector with document
    
    calculations.push({
      indicator: '2.2 Availability of Specialized Entity',
      value: sectorsWithDoc2_2,
      weight: 0.05,
      score: specializedEntityScore,
      maxScore: 50,
    });
    categoryScore += specializedEntityScore;

    // 2.3 Sector Infra Development Plan (50 marks)
    const section2_3 = formData.infraDevelopment?.section2_3 || [];
    const sectorsWithDoc2_3 = section2_3.filter(item => item.files && item.files.length > 0).length;
    const sectorPlanScore = Math.min(sectorsWithDoc2_3 * 10, 50); // 10 marks per sector with document
    
    calculations.push({
      indicator: '2.3 Sector Infra Development Plan',
      value: sectorsWithDoc2_3,
      weight: 0.05,
      score: sectorPlanScore,
      maxScore: 50,
    });
    categoryScore += sectorPlanScore;

    // 2.4 Investment Ready Project Pipeline (50 marks)
    const section2_4 = formData.infraDevelopment?.section2_4 || [];
    const validProjectsWithDocs = section2_4.filter(item => item.dprFile).length;
    const projectPipelineScore = Math.min(validProjectsWithDocs * 10, 50); // 10 marks per project with DPR
    
    calculations.push({
      indicator: '2.4 Investment Ready Project Pipeline',
      value: validProjectsWithDocs,
      weight: 0.05,
      score: projectPipelineScore,
      maxScore: 50,
    });
    categoryScore += projectPipelineScore;

    // 2.5 Asset Monetization Pipeline (50 marks)
    const section2_5 = formData.infraDevelopment?.section2_5 || [];
    const validAssetsProjects = section2_5.filter(item => item.projectName && item.estimatedMonetization).length;
    const assetMonetizationScore = Math.min(validAssetsProjects * 10, 50); // 10 marks per valid asset/project
    
    calculations.push({
      indicator: '2.5 Asset Monetization Pipeline',
      value: validAssetsProjects,
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
    const section3_1 = formData.pppDevelopment?.section3_1 || {};
    const hasPPPAct = (section3_1.available === 'yes' || section3_1.available === 'Yes') && 
                      section3_1.file && section3_1.file.id;
    const pppActScore = hasPPPAct ? 50 : 0; // Binary: Yes + Doc uploaded = 50, else 0
    
    calculations.push({
      indicator: '3.1 Availability of PPP Act/Policy',
      value: hasPPPAct ? 1 : 0,
      weight: 0.05,
      score: pppActScore,
      maxScore: 50,
    });
    categoryScore += pppActScore;

    // 3.2 Functional PPP Cell/Unit (50 marks)
    const section3_2 = formData.pppDevelopment?.section3_2 || {};
    const hasPPPCell = (section3_2.available === 'yes' || section3_2.available === 'Yes') && 
                       section3_2.file && section3_2.file.id;
    const pppCellScore = hasPPPCell ? 50 : 0; // Binary: Yes + Doc uploaded = 50, else 0
    
    calculations.push({
      indicator: '3.2 Functional PPP Cell/Unit',
      value: hasPPPCell ? 1 : 0,
      weight: 0.05,
      score: pppCellScore,
      maxScore: 50,
    });
    categoryScore += pppCellScore;

    // 3.3 Proposals under VGF/IIPDF (50 marks)
    const section3_3 = formData.pppDevelopment?.section3_3 || [];
    const vgfProposals = section3_3.filter(item => item.file && item.file.id).length;
    const vgfScore = Math.min(vgfProposals * 5, 50); // 5 marks per project with document
    
    calculations.push({
      indicator: '3.3 Proposals under VGF/IIPDF',
      value: vgfProposals,
      weight: 0.05,
      score: vgfScore,
      maxScore: 50,
    });
    categoryScore += vgfScore;

    // 3.4 Proportion of TPC of PPP Projects (100 marks)
    const section3_4 = formData.pppDevelopment?.section3_4 || {};
    const totalCostBankablePPP = parseFloat(section3_4.tpcOfPPPProjects) || 0;
    const totalCostAllInfra = parseFloat(section3_4.totalTPC) || 0;
    const proportionRatio = totalCostAllInfra > 0 ? (totalCostBankablePPP / totalCostAllInfra) * 100 : 0;
    const tpcScore = Math.min(proportionRatio * 2, 100); // 2 marks for every 1%
    
    calculations.push({
      indicator: '3.4 Proportion of TPC of PPP Projects',
      value: proportionRatio,
      weight: 0.1,
      score: tpcScore,
      maxScore: 100,
    });
    categoryScore += tpcScore;

    return categoryScore;
  }

  // 4. INFRA ENABLERS CALCULATIONS (250 marks)
  private calculateInfraEnablersScore(formData: Record<string, any>, calculations: ScoreCalculation[]): number {
    let categoryScore = 0;

    // 4.1 All Eligible Infra Projects on NIP Portal (50 marks)
    const section4_1 = formData.infraEnablers?.section4_1 || {};
    const allEligible = (section4_1.allEligible === 'yes' || section4_1.allEligible === 'Yes') && 
                        section4_1.websiteLink && section4_1.websiteLink.trim() !== '';
    const nipScore = allEligible ? 50 : 0; // Binary: Yes + Valid Doc = 50, else 0
    
    calculations.push({
      indicator: '4.1 All Eligible Infra Projects on NIP Portal',
      value: allEligible ? 1 : 0,
      weight: 0.05,
      score: nipScore,
      maxScore: 50,
    });
    categoryScore += nipScore;

    // 4.2 Availability & Use of State/UT PMG (30 marks)
    const section4_2 = formData.infraEnablers?.section4_2 || {};
    const hasPMG = (section4_2.available === 'yes' || section4_2.available === 'Yes') && 
                   section4_2.file && section4_2.file.id;
    const pmgScore = hasPMG ? 30 : 0; // Binary: Yes + Upload = 30, else 0
    
    calculations.push({
      indicator: '4.2 Availability & Use of State/UT PMG',
      value: hasPMG ? 1 : 0,
      weight: 0.03,
      score: pmgScore,
      maxScore: 30,
    });
    categoryScore += pmgScore;

    // 4.3 Adoption of PM GatiShakti (20 marks)
    const section4_3 = formData.infraEnablers?.section4_3 || {};
    const numberOfProjects = parseFloat(section4_3.numberOfProjects) || 0;
    const gatiShaktiScore = Math.min(numberOfProjects * 5, 20); // 5 marks per project
    
    calculations.push({
      indicator: '4.3 Adoption of PM GatiShakti',
      value: numberOfProjects,
      weight: 0.02,
      score: gatiShaktiScore,
      maxScore: 20,
    });
    categoryScore += gatiShaktiScore;

    // 4.4 Adoption of ADR (50 marks)
    const section4_4 = formData.infraEnablers?.section4_4 || {};
    const adoptedADR = (section4_4.adopted === 'yes' || section4_4.adopted === 'Yes') && 
                       section4_4.file && section4_4.file.id;
    const adrScore = adoptedADR ? 50 : 0; // Binary: Yes + Doc uploaded = 50, else 0
    
    calculations.push({
      indicator: '4.4 Adoption of ADR',
      value: adoptedADR ? 1 : 0,
      weight: 0.05,
      score: adrScore,
      maxScore: 50,
    });
    categoryScore += adrScore;

    // 4.5 Innovative Practices (50 marks)
    const section4_5 = formData.infraEnablers?.section4_5 || {};
    const practicesWithEvidence = section4_5.implemented === 'yes' || section4_5.implemented === 'Yes' ? 1 : 0;
    const innovativeScore = Math.min(practicesWithEvidence * 10, 50); // 10 marks per practice
    
    calculations.push({
      indicator: '4.5 Innovative Practices',
      value: practicesWithEvidence,
      weight: 0.05,
      score: innovativeScore,
      maxScore: 50,
    });
    categoryScore += innovativeScore;

    // 4.6 Capacity Building - Officer Participation (50 marks)
    const section4_6 = formData.infraEnablers?.section4_6 || [];
    const participants = section4_6.length;
    const capacityScore = Math.min(participants * 1, 50); // 1 mark per officer
    
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

  async getScoreRankings(): Promise<any[]> {
    const scores = await this.finalScoreRepository
      .createQueryBuilder('fs')
      .leftJoinAndSelect('fs.submission', 's')
      .select([
        'fs.id',
        'fs.submissionId',
        'fs.stateUt',
        'fs.totalScore',
        'fs.percentage',
        'fs.categoryScores',
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
      categoryScores: score.categoryScores,
      submissionId: score.submissionId,
      createdAt: score.createdAt,
    }));
  }

  async getScoreStatistics(): Promise<any> {
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

    // Score distribution
    const distribution = {
      '0-200': 0,
      '201-400': 0,
      '401-600': 0,
      '601-800': 0,
      '801-1000': 0,
    };

    totalScores.forEach(score => {
      if (score <= 200) distribution['0-200']++;
      else if (score <= 400) distribution['201-400']++;
      else if (score <= 600) distribution['401-600']++;
      else if (score <= 800) distribution['601-800']++;
      else distribution['801-1000']++;
    });

    return {
      totalSubmissions: scores.length,
      averageScore: Math.round(averageScore * 100) / 100,
      highestScore,
      lowestScore,
      scoreDistribution: distribution,
    };
  }

  async getStateScore(stateUt: string): Promise<any> {
    const score = await this.finalScoreRepository.findOne({
      where: { stateUt },
      order: { createdAt: 'DESC' },
    });

    if (!score) {
      throw new NotFoundException(`No score found for state: ${stateUt}`);
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

  async getAllScores(page: number = 1, limit: number = 10): Promise<{ scores: any[]; total: number; page: number; totalPages: number }> {
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
}