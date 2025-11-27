import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Submission, SubmissionStatus } from '../../entities/submission.entity';
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

  async calculateScore(submissionId: string, userId: string, skipStatusCheck: boolean = false): Promise<ScoreBreakdown> {
    this.logger.log(`=== SCORING SERVICE: Starting score calculation for submission: ${submissionId} ===`);
    this.logger.log(`Skip status check: ${skipStatusCheck}, User ID: ${userId}`);

    // Step 1: Get submission with form data
    // Retry once if status check fails (to handle potential timing issues after status update)
    this.logger.log(`Step 1: Fetching submission from database...`);
    let submission = await this.submissionRepository.findOne({
      where: { id: submissionId },
    });

    if (!submission) {
      this.logger.error(`❌ Submission with ID ${submissionId} not found`);
      throw new NotFoundException(`Submission with ID ${submissionId} not found`);
    }

    this.logger.log(`Submission found - Status: ${submission.status}, State: ${submission.stateUt}, Has formData: ${!!submission.formData}`);

    // If status check fails and we haven't skipped it, retry once after a short delay
    if (!skipStatusCheck && submission.status !== SubmissionStatus.APPROVED) {
      this.logger.warn(`Submission status is ${submission.status}, retrying after short delay...`);
      await new Promise(resolve => setTimeout(resolve, 200));
      submission = await this.submissionRepository.findOne({
        where: { id: submissionId },
      });
      
      if (!submission) {
        this.logger.error(`❌ Submission with ID ${submissionId} not found after retry`);
        throw new NotFoundException(`Submission with ID ${submissionId} not found after retry`);
      }
      this.logger.log(`After retry - Status: ${submission.status}`);
    }

    if (!skipStatusCheck && submission.status !== SubmissionStatus.APPROVED) {
      this.logger.error(`❌ Submission must be APPROVED. Current status: ${submission.status}`);
      throw new Error(`Submission must be APPROVED to calculate score. Current status: ${submission.status}`);
    }

    // Step 2: Check if score already exists
    this.logger.log(`Step 2: Checking for existing score...`);
    const existingScore = await this.finalScoreRepository.findOne({
      where: { submissionId },
    });

    if (existingScore) {
      this.logger.log(`✅ Score already exists for submission: ${submissionId}, Score: ${existingScore.totalScore}`);
      return existingScore.scoreBreakdown as ScoreBreakdown;
    }
    this.logger.log(`No existing score found, proceeding with calculation...`);

    // Step 3: Validate formData exists
    this.logger.log(`Step 3: Validating formData...`);
    if (!submission.formData || typeof submission.formData !== 'object') {
      this.logger.error(`❌ Submission ${submissionId} has no formData or invalid formData`);
      this.logger.error(`FormData type: ${typeof submission.formData}, Value: ${JSON.stringify(submission.formData).substring(0, 200)}`);
      throw new Error(`Cannot calculate score: Submission has no form data`);
    }

    const formDataKeys = Object.keys(submission.formData);
    this.logger.log(`FormData validated - Keys found: ${formDataKeys.join(', ')}`);

    // Step 4: Calculate score based on form data
    this.logger.log(`Step 4: Performing score calculation...`);
    let scoreBreakdown: ScoreBreakdown;
    try {
      scoreBreakdown = this.performScoreCalculation(submission.formData);
      this.logger.log(`✅ Score calculation completed for submission ${submissionId}: ${scoreBreakdown.totalScore} points (${scoreBreakdown.percentage}%)`);
      this.logger.log(`Category scores: ${JSON.stringify(scoreBreakdown.categoryScores)}`);
    } catch (calcError) {
      this.logger.error(`❌ Score calculation failed for submission ${submissionId}: ${calcError.message}`);
      this.logger.error(`❌ Calculation error stack: ${calcError.stack}`);
      this.logger.error(`FormData structure: ${JSON.stringify(Object.keys(submission.formData))}`);
      throw new Error(`Score calculation failed: ${calcError.message}`);
    }

    // Step 5: Save score to database
    this.logger.log(`Step 5: Saving score to database...`);
    try {
      const finalScore = this.finalScoreRepository.create({
        submissionId,
        stateUt: submission.stateUt,
        totalScore: scoreBreakdown.totalScore,
        percentage: scoreBreakdown.percentage,
        scoreBreakdown,
        categoryScores: scoreBreakdown.categoryScores,
        calculationMethodology: scoreBreakdown.methodology,
        approvedBy: userId,
      });

      this.logger.log(`Created FinalScore entity - SubmissionId: ${finalScore.submissionId}, State: ${finalScore.stateUt}, Score: ${finalScore.totalScore}`);
      
      const savedScore = await this.finalScoreRepository.save(finalScore);
      this.logger.log(`✅ Score saved to database for submission: ${submissionId}, Score ID: ${savedScore.id}, Total Score: ${scoreBreakdown.totalScore}, State: ${submission.stateUt}`);
      
      // Verify it was saved
      const verification = await this.finalScoreRepository.findOne({
        where: { submissionId },
      });
      if (verification) {
        this.logger.log(`✅ Verification: Score confirmed in database with ID: ${verification.id}`);
      } else {
        this.logger.error(`❌ Verification failed: Score not found in database after save`);
        throw new Error(`Score was not saved to database properly`);
      }
    } catch (saveError) {
      this.logger.error(`❌ Failed to save score for submission ${submissionId}: ${saveError.message}`);
      this.logger.error(`❌ Save error stack: ${saveError.stack}`);
      throw new Error(`Failed to save score: ${saveError.message}`);
    }

    this.logger.log(`=== SCORING SERVICE: Score calculation completed successfully for submission: ${submissionId} ===`);
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
          score: Math.round(infraFinancingScore * 100) / 100,
          maxScore: 250,
          percentage: Math.round((infraFinancingScore / 250) * 100 * 100) / 100
        },
        infraDevelopment: {
          score: Math.round(infraDevelopmentScore * 100) / 100,
          maxScore: 250,
          percentage: Math.round((infraDevelopmentScore / 250) * 100 * 100) / 100
        },
        pppDevelopment: {
          score: Math.round(pppDevelopmentScore * 100) / 100,
          maxScore: 250,
          percentage: Math.round((pppDevelopmentScore / 250) * 100 * 100) / 100
        },
        infraEnablers: {
          score: Math.round(infraEnablersScore * 100) / 100,
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

    // 1.3 % of Credit Rated ULBs (50 marks) - FIXED: Use totalULBs from form data
    const section1_3Raw = formData.infraFinancing?.section1_3;
    // Handle both array format and object with ulbList format
    let section1_3Array: any[] = [];
    let totalULBs = 0;
    
    if (Array.isArray(section1_3Raw)) {
      section1_3Array = section1_3Raw;
    } else if (section1_3Raw && typeof section1_3Raw === 'object') {
      // Check for ulbList array
      if (Array.isArray(section1_3Raw.ulbList)) {
        section1_3Array = section1_3Raw.ulbList;
      } else {
        section1_3Array = this.normalizeToArray(section1_3Raw);
      }
      // Get totalULBs from form data
      totalULBs = parseFloat(section1_3Raw.totalULBs) || 0;
    }
    
    const creditRatedULBs = section1_3Array.length;
    const creditRatedRatio = totalULBs > 0 ? (creditRatedULBs / totalULBs) * 100 : 0;
    const creditRatedScore = Math.min(creditRatedRatio / 2, 50); // 1 mark for every 2%
    
    calculations.push({
      indicator: '1.3 % of Credit Rated ULBs',
      value: creditRatedRatio,
      weight: 0.05,
      score: creditRatedScore,
      maxScore: 50,
    });
    categoryScore += creditRatedScore;

    // 1.4 % of ULBs Issuing Bonds (50 marks) - FIXED: Use totalULBs from form data
    const section1_4Raw = formData.infraFinancing?.section1_4;
    // Handle both array format and object with bondList format
    let section1_4Array: any[] = [];
    let totalULBsEntered = 0;
    
    if (Array.isArray(section1_4Raw)) {
      section1_4Array = section1_4Raw;
    } else if (section1_4Raw && typeof section1_4Raw === 'object') {
      // Check for bondList array
      if (Array.isArray(section1_4Raw.bondList)) {
        section1_4Array = section1_4Raw.bondList;
      } else {
        section1_4Array = this.normalizeToArray(section1_4Raw);
      }
      // Get totalULBs from form data
      totalULBsEntered = parseFloat(section1_4Raw.totalULBs) || 0;
    }
    
    const ulbsIssuingBonds = section1_4Array.length;
    const ulbsBondsRatio = totalULBsEntered > 0 ? (ulbsIssuingBonds / totalULBsEntered) * 100 : 0;
    const ulbsBondsScore = Math.min(ulbsBondsRatio * 2, 50); // 2 marks for every 1%
    
    calculations.push({
      indicator: '1.4 % of ULBs Issuing Bonds',
      value: ulbsBondsRatio,
      weight: 0.05,
      score: ulbsBondsScore,
      maxScore: 50,
    });
    categoryScore += ulbsBondsScore;

    // 1.5 Functional Financial Intermediary (50 marks) - FIXED: Binary scoring
    const section1_5 = formData.infraFinancing?.section1_5 || {};
    const hasIntermediary = section1_5.hasIntermediary === 'yes' || section1_5.hasIntermediary === 'Yes';
    
    // Get ffiArray
    let ffiArray: any[] = [];
    if (Array.isArray(section1_5.ffiArray)) {
      ffiArray = section1_5.ffiArray;
    } else {
      ffiArray = this.normalizeToArray(section1_5);
    }
    
    // Check if has valid entry with required details (organization, type, funding, website)
    const hasValidFFI = hasIntermediary && ffiArray.length > 0 && ffiArray.some(entry => 
      entry && 
      entry.organisationName && entry.organisationName.trim() !== '' &&
      entry.organisationType && entry.organisationType.trim() !== '' &&
      entry.totalFunding && entry.totalFunding.trim() !== '' &&
      entry.website && entry.website.trim() !== ''
    );
    
    const financialIntermediaryScore = hasValidFFI ? 50 : 0; // Binary: 50 if Yes + valid details, else 0
    
    calculations.push({
      indicator: '1.5 Functional Financial Intermediary',
      value: hasValidFFI ? 1 : 0,
      weight: 0.05,
      score: financialIntermediaryScore,
      maxScore: 50,
    });
    categoryScore += financialIntermediaryScore;

    return categoryScore;
  }

  /**
   * Helper function to normalize section data to array format
   * Handles both array and object formats
   */
  private normalizeToArray(section: any): any[] {
    if (!section) return [];
    if (Array.isArray(section)) return section;
    if (typeof section === 'object') {
      // If it's an object, check if it has array-like properties
      // Try common array property names
      if (section.data && Array.isArray(section.data)) return section.data;
      if (section.items && Array.isArray(section.items)) return section.items;
      if (section.array && Array.isArray(section.array)) return section.array;
      if (section.ulbList && Array.isArray(section.ulbList)) return section.ulbList;
      if (section.bondList && Array.isArray(section.bondList)) return section.bondList;
      if (section.ffiArray && Array.isArray(section.ffiArray)) return section.ffiArray;
      if (section.infraActArray && Array.isArray(section.infraActArray)) return section.infraActArray;
      if (section.specializedEntityArray && Array.isArray(section.specializedEntityArray)) return section.specializedEntityArray;
      if (section.infraDevelopmentArray && Array.isArray(section.infraDevelopmentArray)) return section.infraDevelopmentArray;
      if (section.investmentReadyArray && Array.isArray(section.investmentReadyArray)) return section.investmentReadyArray;
      if (section.assetMonetizationArray && Array.isArray(section.assetMonetizationArray)) return section.assetMonetizationArray;
      if (section.VGFArray && Array.isArray(section.VGFArray)) return section.VGFArray;
      if (section.projects && Array.isArray(section.projects)) return section.projects;
      if (section.practices && Array.isArray(section.practices)) return section.practices;
      if (section.capacityArray && Array.isArray(section.capacityArray)) return section.capacityArray;
      // If object has numeric keys or is an object with values, convert to array
      const values = Object.values(section);
      if (values.length > 0 && values.every(v => typeof v === 'object')) {
        return values as any[];
      }
      // If it's a single object, wrap it in an array
      return [section];
    }
    return [];
  }

  // 2. INFRA DEVELOPMENT CALCULATIONS (250 marks)
  private calculateInfraDevelopmentScore(formData: Record<string, any>, calculations: ScoreCalculation[]): number {
    let categoryScore = 0;

    // 2.1 Availability of Infrastructure Act/Policy (50 marks) - FIXED: Overarching logic
    const section2_1Raw = formData.infraDevelopment?.section2_1;
    let section2_1: any[] = [];
    
    if (Array.isArray(section2_1Raw)) {
      section2_1 = section2_1Raw;
    } else if (section2_1Raw && typeof section2_1Raw === 'object') {
      if (Array.isArray(section2_1Raw.infraActArray)) {
        section2_1 = section2_1Raw.infraActArray;
      } else {
        section2_1 = this.normalizeToArray(section2_1Raw);
      }
    }
    
    // Check if there's an overarching policy (sector === "Overarching" or similar)
    const hasOverarching = section2_1.some(item => 
      item && item.sector && (
        item.sector.toLowerCase() === 'overarching' || 
        item.sector.toLowerCase().includes('overarching')
      )
    );
    
    const sectorsWithDoc2_1 = section2_1.filter(item => {
      if (!item) return false;
      const hasFiles = item.files && (
        Array.isArray(item.files) ? item.files.length > 0 : 
        (item.files.id || item.files.fileName || item.files.filePath)
      );
      return hasFiles;
    }).length;
    
    let infraActScore = 0;
    if (hasOverarching && sectorsWithDoc2_1 > 0) {
      infraActScore = 50; // Full marks if overarching + doc
    } else {
      infraActScore = Math.min(sectorsWithDoc2_1 * 10, 50); // 10 marks per sector with doc, max 50
    }
    
    calculations.push({
      indicator: '2.1 Availability of Infrastructure Act/Policy',
      value: sectorsWithDoc2_1,
      weight: 0.05,
      score: infraActScore,
      maxScore: 50,
    });
    categoryScore += infraActScore;

    // 2.2 Availability of Specialized Entity (50 marks) - FIXED: Binary scoring
    const section2_2Raw = formData.infraDevelopment?.section2_2;
    let section2_2: any[] = [];
    
    if (Array.isArray(section2_2Raw)) {
      section2_2 = section2_2Raw;
    } else if (section2_2Raw && typeof section2_2Raw === 'object') {
      if (Array.isArray(section2_2Raw.specializedEntityArray)) {
        section2_2 = section2_2Raw.specializedEntityArray;
      } else {
        section2_2 = this.normalizeToArray(section2_2Raw);
      }
    }
    
    // Check if available (has entries) and has file upload
    const hasSpecializedEntity = section2_2.length > 0 && section2_2.some(item => {
      if (!item) return false;
      const hasFiles = item.files && (
        Array.isArray(item.files) ? item.files.length > 0 : 
        (item.files.id || item.files.fileName || item.files.filePath)
      );
      return hasFiles;
    });
    
    const specializedEntityScore = hasSpecializedEntity ? 50 : 0; // Binary: 50 if Yes + file, else 0
    
    calculations.push({
      indicator: '2.2 Availability of Specialized Entity',
      value: hasSpecializedEntity ? 1 : 0,
      weight: 0.05,
      score: specializedEntityScore,
      maxScore: 50,
    });
    categoryScore += specializedEntityScore;

    // 2.3 Sector Infra Development Plan (50 marks) - FIXED: Overarching logic
    const section2_3Raw = formData.infraDevelopment?.section2_3;
    let section2_3: any[] = [];
    
    if (Array.isArray(section2_3Raw)) {
      section2_3 = section2_3Raw;
    } else if (section2_3Raw && typeof section2_3Raw === 'object') {
      if (Array.isArray(section2_3Raw.infraDevelopmentArray)) {
        section2_3 = section2_3Raw.infraDevelopmentArray;
      } else {
        section2_3 = this.normalizeToArray(section2_3Raw);
      }
    }
    
    const hasOverarching2_3 = section2_3.some(item => 
      item && item.sector && (
        item.sector.toLowerCase() === 'overarching' || 
        item.sector.toLowerCase().includes('overarching')
      )
    );
    
    const sectorsWithDoc2_3 = section2_3.filter(item => {
      if (!item) return false;
      const hasFiles = item.files && (
        Array.isArray(item.files) ? item.files.length > 0 : 
        (item.files.id || item.files.fileName || item.files.filePath)
      );
      return hasFiles;
    }).length;
    
    let sectorPlanScore = 0;
    if (hasOverarching2_3 && sectorsWithDoc2_3 > 0) {
      sectorPlanScore = 50; // Full marks if overarching + doc
    } else {
      sectorPlanScore = Math.min(sectorsWithDoc2_3 * 10, 50); // 10 marks per sector with doc, max 50
    }
    
    calculations.push({
      indicator: '2.3 Sector Infra Development Plan',
      value: sectorsWithDoc2_3,
      weight: 0.05,
      score: sectorPlanScore,
      maxScore: 50,
    });
    categoryScore += sectorPlanScore;

    // 2.4 Investment Ready Project Pipeline (50 marks) - FIXED: Accept websiteLink OR dprFile
    const section2_4Raw = formData.infraDevelopment?.section2_4;
    let section2_4: any[] = [];
    let section2_4WebsiteLink: string | undefined;
    
    if (Array.isArray(section2_4Raw)) {
      section2_4 = section2_4Raw;
    } else if (section2_4Raw && typeof section2_4Raw === 'object') {
      if (Array.isArray(section2_4Raw.investmentReadyArray)) {
        section2_4 = section2_4Raw.investmentReadyArray;
      } else {
        section2_4 = this.normalizeToArray(section2_4Raw);
      }
      // Get websiteLink from section level
      section2_4WebsiteLink = section2_4Raw.websiteLink;
    }
    
    // Count valid projects: either have dprFile OR section has websiteLink
    // If section has websiteLink, all projects in the array are valid
    // Otherwise, only projects with dprFile are valid
    const hasSectionWebsiteLink = section2_4WebsiteLink && section2_4WebsiteLink.trim() !== '';
    
    const validProjectsWithDocs = hasSectionWebsiteLink 
      ? section2_4.length // If websiteLink exists, count all projects
      : section2_4.filter(item => {
          if (!item) return false;
          const hasDprFile = item.dprFile && (
            Array.isArray(item.dprFile) ? item.dprFile.length > 0 :
            (item.dprFile.id || item.dprFile.fileName || item.dprFile.filePath)
          );
          return hasDprFile;
        }).length;
    
    const projectPipelineScore = Math.min(validProjectsWithDocs * 10, 50); // 10 marks per project with DPR or websiteLink
    
    calculations.push({
      indicator: '2.4 Investment Ready Project Pipeline',
      value: validProjectsWithDocs,
      weight: 0.05,
      score: projectPipelineScore,
      maxScore: 50,
    });
    categoryScore += projectPipelineScore;

    // 2.5 Asset Monetization Pipeline (50 marks)
    const section2_5Raw = formData.infraDevelopment?.section2_5;
    let section2_5: any[] = [];
    
    if (Array.isArray(section2_5Raw)) {
      section2_5 = section2_5Raw;
    } else if (section2_5Raw && typeof section2_5Raw === 'object') {
      if (Array.isArray(section2_5Raw.assetMonetizationArray)) {
        section2_5 = section2_5Raw.assetMonetizationArray;
      } else {
        section2_5 = this.normalizeToArray(section2_5Raw);
      }
    }
    
    const validAssetsProjects = section2_5.filter(item => 
      item && item.projectName && item.estimatedMonetization
    ).length;
    
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
                      section3_1.file && (section3_1.file.id || section3_1.file.fileName || section3_1.file.filePath);
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
                       section3_2.file && (section3_2.file.id || section3_2.file.fileName || section3_2.file.filePath);
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
    const section3_3Raw = formData.pppDevelopment?.section3_3;
    let section3_3: any[] = [];
    
    if (Array.isArray(section3_3Raw)) {
      section3_3 = section3_3Raw;
    } else if (section3_3Raw && typeof section3_3Raw === 'object') {
      if (Array.isArray(section3_3Raw.VGFArray)) {
        section3_3 = section3_3Raw.VGFArray;
      } else {
        section3_3 = this.normalizeToArray(section3_3Raw);
      }
    }
    
    const vgfProposals = section3_3.filter(item => {
      if (!item) return false;
      const hasFile = item.file && (
        Array.isArray(item.file) ? item.file.length > 0 :
        (item.file.id || item.file.fileName || item.file.filePath)
      );
      return hasFile;
    }).length;
    
    const vgfScore = Math.min(vgfProposals * 5, 50); // 5 marks per project with document
    
    calculations.push({
      indicator: '3.3 Proposals under VGF/IIPDF',
      value: vgfProposals,
      weight: 0.05,
      score: vgfScore,
      maxScore: 50,
    });
    categoryScore += vgfScore;

    // 3.4 Proportion of TPC of PPP Projects (100 marks) - FIXED: Calculate % first, then marks
    const section3_4 = formData.pppDevelopment?.section3_4 || {};
    const totalCostBankablePPP = parseFloat(section3_4.tpcOfPPPProjects) || 0;
    const totalCostAllInfra = parseFloat(section3_4.totalTPC) || 0;
    
    // First calculate percentage: % = (A1 / A2) × 100
    const proportionPercentage = totalCostAllInfra > 0 ? (totalCostBankablePPP / totalCostAllInfra) * 100 : 0;
    
    // Then calculate marks: Marks = % × 2, max 100
    const tpcScore = Math.min(proportionPercentage * 2, 100);
    
    calculations.push({
      indicator: '3.4 Proportion of TPC of PPP Projects',
      value: proportionPercentage,
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

    // 4.1 All Eligible Infra Projects on NIP Portal (50 marks) - FIXED: Accept file or link
    const section4_1 = formData.infraEnablers?.section4_1 || {};
    const allEligible = (section4_1.allEligible === 'yes' || section4_1.allEligible === 'Yes') && 
                        (
                          (section4_1.websiteLink && section4_1.websiteLink.trim() !== '') ||
                          (section4_1.file && (section4_1.file.id || section4_1.file.fileName || section4_1.file.filePath))
                        );
    const nipScore = allEligible ? 50 : 0; // Binary: Yes + File or Link = 50, else 0
    
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
                   section4_2.file && (section4_2.file.id || section4_2.file.fileName || section4_2.file.filePath);
    const pmgScore = hasPMG ? 30 : 0; // Binary: Yes + Upload = 30, else 0
    
    calculations.push({
      indicator: '4.2 Availability & Use of State/UT PMG',
      value: hasPMG ? 1 : 0,
      weight: 0.03,
      score: pmgScore,
      maxScore: 30,
    });
    categoryScore += pmgScore;

    // 4.3 Adoption of PM GatiShakti (20 marks) - FIXED: Count projects array with docs
    const section4_3 = formData.infraEnablers?.section4_3 || {};
    let projectsArray: any[] = [];
    
    if (Array.isArray(section4_3.projects)) {
      projectsArray = section4_3.projects;
    } else {
      projectsArray = this.normalizeToArray(section4_3);
    }
    
    // Count projects with documents uploaded
    const projectsWithDocs = projectsArray.filter(item => {
      if (!item) return false;
      const hasFile = item.file && (
        Array.isArray(item.file) ? item.file.length > 0 :
        (item.file.id || item.file.fileName || item.file.filePath)
      );
      return hasFile;
    }).length;
    
    const gatiShaktiScore = Math.min(projectsWithDocs * 5, 20); // 5 marks per project with docs, max 20
    
    calculations.push({
      indicator: '4.3 Adoption of PM GatiShakti',
      value: projectsWithDocs,
      weight: 0.02,
      score: gatiShaktiScore,
      maxScore: 20,
    });
    categoryScore += gatiShaktiScore;

    // 4.4 Adoption of ADR (50 marks)
    const section4_4 = formData.infraEnablers?.section4_4 || {};
    const adoptedADR = (section4_4.adopted === 'yes' || section4_4.adopted === 'Yes') && 
                       section4_4.file && (section4_4.file.id || section4_4.file.fileName || section4_4.file.filePath);
    const adrScore = adoptedADR ? 50 : 0; // Binary: Yes + Doc uploaded = 50, else 0
    
    calculations.push({
      indicator: '4.4 Adoption of ADR',
      value: adoptedADR ? 1 : 0,
      weight: 0.05,
      score: adrScore,
      maxScore: 50,
    });
    categoryScore += adrScore;

    // 4.5 Innovative Practices (50 marks) - FIXED: Count practices array with evidence
    const section4_5 = formData.infraEnablers?.section4_5 || {};
    let practicesArray: any[] = [];
    
    if (Array.isArray(section4_5.practices)) {
      practicesArray = section4_5.practices;
    } else {
      practicesArray = this.normalizeToArray(section4_5);
    }
    
    // Count validated practices (with evidence/file)
    const validatedPractices = practicesArray.filter(practice => {
      if (!practice) return false;
      const hasFile = practice.file && (
        Array.isArray(practice.file) ? practice.file.length > 0 :
        (practice.file.id || practice.file.fileName || practice.file.filePath)
      );
      return hasFile;
    }).length;
    
    const innovativeScore = Math.min(validatedPractices * 10, 50); // 10 marks per validated practice, max 50
    
    calculations.push({
      indicator: '4.5 Innovative Practices',
      value: validatedPractices,
      weight: 0.05,
      score: innovativeScore,
      maxScore: 50,
    });
    categoryScore += innovativeScore;

    // 4.6 Capacity Building - Officer Participation (50 marks)
    const section4_6Raw = formData.infraEnablers?.section4_6;
    let section4_6: any[] = [];
    
    if (Array.isArray(section4_6Raw)) {
      section4_6 = section4_6Raw;
    } else if (section4_6Raw && typeof section4_6Raw === 'object') {
      if (Array.isArray(section4_6Raw.capacityArray)) {
        section4_6 = section4_6Raw.capacityArray;
      } else {
        section4_6 = this.normalizeToArray(section4_6Raw);
      }
    }
    
    const participants = section4_6.length;
    const capacityScore = Math.min(participants * 1, 50); // 1 mark per officer, max 50
    
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

  /**
   * Get diagnostic information about approved submissions and their scores
   */
  async getDiagnostics(): Promise<{
    approvedSubmissions: number;
    submissionsWithScores: number;
    submissionsWithoutScores: number;
    approvedSubmissionsList: Array<{
      id: string;
      stateUt: string;
      status: string;
      hasScore: boolean;
      hasFormData: boolean;
      createdAt: Date;
    }>;
  }> {
    // Get all approved submissions
    const approvedSubmissions = await this.submissionRepository.find({
      where: { status: SubmissionStatus.APPROVED },
      select: ['id', 'stateUt', 'status', 'formData', 'createdAt'],
      order: { createdAt: 'DESC' },
    });

    // Get all scores
    const allScores = await this.finalScoreRepository.find({
      select: ['submissionId'],
    });
    const scoreSubmissionIds = new Set(allScores.map(s => s.submissionId));

    const submissionsList = approvedSubmissions.map(sub => ({
      id: sub.id,
      stateUt: sub.stateUt,
      status: sub.status,
      hasScore: scoreSubmissionIds.has(sub.id),
      hasFormData: !!sub.formData && typeof sub.formData === 'object',
      createdAt: sub.createdAt,
    }));

    return {
      approvedSubmissions: approvedSubmissions.length,
      submissionsWithScores: submissionsList.filter(s => s.hasScore).length,
      submissionsWithoutScores: submissionsList.filter(s => !s.hasScore).length,
      approvedSubmissionsList: submissionsList,
    };
  }

  /**
   * Calculate scores for all approved submissions that don't have scores yet
   * This is useful for backfilling scores for submissions approved before the auto-calculation was implemented
   */
  async calculateMissingScores(userId: string): Promise<{ calculated: number; failed: number; errors: string[] }> {
    this.logger.log('Starting to calculate missing scores for approved submissions...');
    
    // Find all approved submissions that don't have scores
    const approvedSubmissions = await this.submissionRepository
      .createQueryBuilder('s')
      .leftJoin('final_scores', 'fs', 'fs.submissionId = s.id')
      .where('s.status = :status', { status: SubmissionStatus.APPROVED })
      .andWhere('fs.id IS NULL')
      .getMany();

    this.logger.log(`Found ${approvedSubmissions.length} approved submissions without scores`);

    let calculated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const submission of approvedSubmissions) {
      try {
        this.logger.log(`Attempting to calculate score for submission: ${submission.id} (${submission.stateUt})`);
        await this.calculateScore(submission.id, userId, true);
        calculated++;
        this.logger.log(`✅ Calculated score for submission: ${submission.id} (${submission.stateUt})`);
      } catch (error) {
        failed++;
        const errorMsg = `Failed to calculate score for submission ${submission.id} (${submission.stateUt}): ${error.message}`;
        errors.push(errorMsg);
        this.logger.error(errorMsg);
        this.logger.error(`Error stack: ${error.stack}`);
      }
    }

    this.logger.log(`Score calculation complete: ${calculated} calculated, ${failed} failed`);

    return { calculated, failed, errors };
  }
}