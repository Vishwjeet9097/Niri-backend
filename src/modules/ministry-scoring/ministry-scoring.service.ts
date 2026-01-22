import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not, DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { MinistrySubmission } from '../../ministry/entities/ministry-submission.entity';
import { MinistrySubmissionIndicator } from '../../ministry/entities/ministry-submission-indicator.entity';
import { MinistrySubmissionData } from '../../ministry/entities/ministry-submission-data.entity';
import { IndicatorDetail } from '../../ministry/entities/indicator-detail.entity';
import { IndicatorSubsection } from '../../ministry/entities/indicator-subsection.entity';
import { InputField } from '../../ministry/entities/input-field.entity';
import { MinistryIndicatorScore } from '../../entities/ministry-indicator-score.entity';
import { MinistryIndicatorScoreHistory } from '../../entities/ministry-indicator-score-history.entity';
import { MinistryManualScoreUpdate } from '../../entities/ministry-manual-score-update.entity';
import { MinistryFinalScore } from '../../entities/ministry-final-score.entity';
import { Form } from '../../ministry/entities/form.entity';

export interface MinistryScoreCalculation {
  indicator: string;
  value: number;
  weight: number;
  score: number;
  maxScore: number;
  source?: 'system' | 'manual';
}

export interface MinistryScoreBreakdown {
  totalScore: number;
  maxPossibleScore: number;
  percentage: number;
  calculations: MinistryScoreCalculation[];
  categoryScores: {
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

@Injectable()
export class MinistryScoringService {
  private readonly logger = new Logger(MinistryScoringService.name);

  // Debouncing queue to prevent duplicate calculations
  private calculationQueue = new Map<string, NodeJS.Timeout>();

  constructor(
    @InjectRepository(MinistrySubmission)
    private ministrySubmissionRepository: Repository<MinistrySubmission>,
    @InjectRepository(MinistrySubmissionIndicator)
    private ministrySubmissionIndicatorRepository: Repository<MinistrySubmissionIndicator>,
    @InjectRepository(MinistrySubmissionData)
    private ministrySubmissionDataRepository: Repository<MinistrySubmissionData>,
    @InjectRepository(IndicatorDetail)
    private indicatorDetailRepository: Repository<IndicatorDetail>,
    @InjectRepository(IndicatorSubsection)
    private indicatorSubsectionRepository: Repository<IndicatorSubsection>,
    @InjectRepository(InputField)
    private inputFieldRepository: Repository<InputField>,
    @InjectRepository(MinistryIndicatorScore)
    private ministryIndicatorScoreRepository: Repository<MinistryIndicatorScore>,
    @InjectRepository(MinistryIndicatorScoreHistory)
    private ministryIndicatorScoreHistoryRepository: Repository<MinistryIndicatorScoreHistory>,
    @InjectRepository(MinistryManualScoreUpdate)
    private ministryManualScoreUpdateRepository: Repository<MinistryManualScoreUpdate>,
    @InjectRepository(MinistryFinalScore)
    private ministryFinalScoreRepository: Repository<MinistryFinalScore>,
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  /**
   * Calculate score for a ministry submission
   */
  async calculateScore(
    submissionId: string,
    userId: string
  ): Promise<MinistryScoreBreakdown> {
    this.logger.log(`🧮 Calculating score for ministry submission ${submissionId}`);

    // Get submission by UUID or submissionId
    let submission = await this.ministrySubmissionRepository.findOne({
      where: { id: submissionId },
    });

    if (!submission) {
      // Try finding by submissionId (SUB- format)
      submission = await this.ministrySubmissionRepository.findOne({
        where: { submissionId: submissionId },
      });
    }

    if (!submission) {
      throw new NotFoundException(`Ministry submission not found: ${submissionId}`);
    }

    // Get all indicators for this submission
    const indicators = await this.ministrySubmissionIndicatorRepository.find({
      where: { submissionId: submission.id },
    });

    if (indicators.length === 0) {
      throw new NotFoundException(`No indicators found for submission ${submissionId}`);
    }

    // Get all submission data
    const submissionIndicatorIds = indicators.map(ind => ind.id);
    const submissionData = await this.ministrySubmissionDataRepository.find({
      where: {
        submissionIndicatorId: In(submissionIndicatorIds),
      },
    });

    // Get indicator details
    const indicatorIds = indicators.map(ind => ind.indicatorId);
    const indicatorDetails = await this.indicatorDetailRepository.find({
      where: { id: In(indicatorIds) },
    });

    // Get input fields for all indicators
    const inputFields = await this.inputFieldRepository.find({
      where: { sectionId: In(indicatorIds) },
    });

    // Transform submission data to formData structure
    const formData = this.transformSubmissionDataToFormData(
      indicators,
      indicatorDetails,
      submissionData,
      inputFields
    );

    // Calculate scores
    const scoreBreakdown = this.performScoreCalculation(formData);

    this.logger.log(
      `✅ Calculated ministry score: ${scoreBreakdown.totalScore}/${scoreBreakdown.maxPossibleScore} (${scoreBreakdown.percentage}%)`
    );

    return scoreBreakdown;
  }

  /**
   * Transform ministry submission data to formData structure
   */
  private transformSubmissionDataToFormData(
    indicators: MinistrySubmissionIndicator[],
    indicatorDetails: IndicatorDetail[],
    submissionData: MinistrySubmissionData[],
    inputFields: InputField[]
  ): Record<string, any> {
    const formData: Record<string, any> = {};

    // Create maps for quick lookup
    const indicatorDetailMap = new Map<string, IndicatorDetail>();
    indicatorDetails.forEach(ind => indicatorDetailMap.set(ind.id, ind));

    const inputFieldMap = new Map<string, InputField>();
    inputFields.forEach(field => inputFieldMap.set(field.id, field));

    indicators.forEach(indicator => {
      const indicatorDetail = indicatorDetailMap.get(indicator.indicatorId);
      if (!indicatorDetail) return;

      const sNo = indicatorDetail.sNo; // e.g., "1.1", "1.2"
      const category = this.getCategoryFromIndicatorCode(sNo);
      const sectionKey = `section${sNo.replace('.', '_')}`;

      if (!formData[category]) {
        formData[category] = {};
      }

      // Get all data for this submission indicator
      const indicatorData = submissionData.filter(
        data => data.submissionIndicatorId === indicator.id
      );

      // Transform data to formData structure by input field label/name
      const sectionData: any = {};
      indicatorData.forEach(data => {
        const inputField = inputFieldMap.get(data.inputFieldId);
        if (!inputField) return;

        // Get value based on data type
        let value: any = null;
        if (data.valueNumber !== null) {
          value = data.valueNumber;
        } else if (data.valueText !== null) {
          value = data.valueText;
        } else if (data.valueDate !== null) {
          value = data.valueDate;
        } else if (data.valueJson !== null) {
          value = data.valueJson;
        }

        // Store by input field label (normalized) or ID
        const fieldKey = this.normalizeFieldName(inputField.label || inputField.id);
        sectionData[fieldKey] = value;
        
        // Also store by ID for fallback
        sectionData[inputField.id] = value;
      });

      formData[category][sectionKey] = sectionData;
    });

    return formData;
  }

  /**
   * Normalize field name for consistent lookup
   */
  private normalizeFieldName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  /**
   * Get category from indicator code (sNo)
   */
  private getCategoryFromIndicatorCode(sNo: string): string {
    if (sNo.startsWith('1.')) return 'infraFinancing';
    if (sNo.startsWith('2.')) return 'infraDevelopment';
    if (sNo.startsWith('3.')) return 'pppDevelopment';
    if (sNo.startsWith('4.')) return 'infraEnablers';
    return 'infraFinancing';
  }

  /**
   * Perform score calculation based on ministry scoring methodology
   */
  private performScoreCalculation(formData: Record<string, any>): MinistryScoreBreakdown {
    const calculations: MinistryScoreCalculation[] = [];
    let totalScore = 0;
    let maxPossibleScore = 0;

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
          percentage: Math.round((infraFinancingScore / 250) * 100 * 100) / 100,
        },
        infraDevelopment: {
          score: Math.round(infraDevelopmentScore * 100) / 100,
          maxScore: 250,
          percentage: Math.round((infraDevelopmentScore / 250) * 100 * 100) / 100,
        },
        pppDevelopment: {
          score: Math.round(pppDevelopmentScore * 100) / 100,
          maxScore: 250,
          percentage: Math.round((pppDevelopmentScore / 250) * 100 * 100) / 100,
        },
        infraEnablers: {
          score: Math.round(infraEnablersScore * 100) / 100,
          maxScore: 250,
          percentage: Math.round((infraEnablersScore / 250) * 100 * 100) / 100,
        },
      },
      methodology: 'NIRI Ministry Scoring Methodology v1.0',
    };
  }

  // 1. INFRA FINANCING CALCULATIONS (250 marks)
  private calculateInfraFinancingScore(
    formData: Record<string, any>,
    calculations: MinistryScoreCalculation[]
  ): number {
    let categoryScore = 0;

    ['1.1', '1.2', '1.3'].forEach(code => {
      const calc = this.calculateInfraFinancingIndicator(code, formData);
      calculations.push(calc);
      categoryScore += calc.score;
    });

    return categoryScore;
  }

  private calculateInfraFinancingIndicator(
    indicatorCode: string,
    formData: Record<string, any>
  ): MinistryScoreCalculation {
    const sectionKey = `section${indicatorCode.replace('.', '_')}`;
    const section = formData.infraFinancing?.[sectionKey] || {};

    // Debug logging to see what data we have
    this.logger.debug(`🔍 Calculating indicator ${indicatorCode}, sectionKey: ${sectionKey}`);
    this.logger.debug(`🔍 Section data keys: ${Object.keys(section).join(', ')}`);
    this.logger.debug(`🔍 Section data: ${JSON.stringify(section, null, 2)}`);

    switch (indicatorCode) {
      case '1.1': {
        // % Capex Utilization = (Actuals ÷ Total Budgeted Capex) × 100
        // Score = 1 mark for every 1%, Max 100
        // Try multiple possible field name variations - including the actual field names from the form
        // The actual field names in the data are:
        // - "Capital Expenditure Actuals for FY (INR)" -> normalized: "capitalexpenditureactualsforfyinr"
        // - "Capital Expenditure Allocation for FY (INR)" -> normalized: "capitalexpenditureallocationforfyinr"
        const actuals = this.getNumericValue(section, [
          'Capital Expenditure Actuals for FY (INR)', // Exact original label (stored as-is)
          'capitalexpenditureactualsforfyinr', // Normalized version (also stored)
          'capital expenditure actuals for fy (inr)', // Lowercase version
          'Capital Expenditure Actuals for FY (INR)'.toLowerCase(), // Lowercase exact
          'actualcapex', 
          'actualcapexutilization', 
          'actuals', 
          'actualcapitalexpenditure',
          'actual capital expenditure',
          'actual capital expenditure for fy',
          'actual capital expenditure for fy (inr-crore)',
          'actual capex',
          'actual capex utilization',
          'capital expenditure actuals',
          'capital expenditure actuals (inr crore)',
          'actual capital expenditure (inr crore)'
        ]);
        const totalBudgetedCapex = this.getNumericValue(section, [
          'Capital Expenditure Allocation for FY (INR)', // Exact original label (stored as-is)
          'capitalexpenditureallocationforfyinr', // Normalized version (also stored)
          'capital expenditure allocation for fy (inr)', // Lowercase version
          'Capital Expenditure Allocation for FY (INR)'.toLowerCase(), // Lowercase exact
          'totalbudgetedcapex', 
          'budgetedcapex', 
          'totalcapex', 
          'budgetedcapitalallocation',
          'total budgeted capex',
          'total budgeted capex allocation',
          'total budgeted capex allocation for fy',
          'total budgeted capex allocation for fy (inr-crore)',
          'budgeted capital allocation',
          'budgeted capital expenditure',
          'total budgeted capital allocation',
          'total budgeted capital allocation (inr crore)'
        ]);
        
        this.logger.debug(`🔍 Indicator 1.1 - Actuals: ${actuals}, Total Budgeted Capex: ${totalBudgetedCapex}`);
        
        const capexUtilization = totalBudgetedCapex > 0 ? (actuals / totalBudgetedCapex) * 100 : 0;
        const score = Math.min(capexUtilization * 1, 100); // 1 mark per 1%

        this.logger.debug(`🔍 Indicator 1.1 - Capex Utilization: ${capexUtilization}%, Score: ${score}`);

        return {
          indicator: '1.1 % Capex Utilization',
          value: capexUtilization,
          weight: 0.1,
          score,
          maxScore: 100,
        };
      }
      case '1.2': {
        // Asset Monetization Pipeline Utilization
        // A1 = (Actual Utilization / Estimated Monetization Value) * 100
        // A2 = A1 / 2
        // Score = A2 * 1.5, Max 75
        const actualUtilization = this.getNumericValue(section, [
          'Actual Utilization (INR Cr)', // Exact original label (stored as-is)
          'actualutilizationinrcr', // Normalized version (also stored)
          'actual utilization (inr cr)', // Lowercase version
          'Actual Utilization (INR Cr)'.toLowerCase(), // Lowercase exact
          'actualutilization',
          'actualmonetization',
          'actualvalue',
          'actual utilization',
          'actual utilization value',
          'actual monetization value',
          'actual monetization utilization',
          'actual utilization (inr crore)',
          'actual utilization (inr-crore)'
        ]);
        const estimatedMonetizationValue = this.getNumericValue(section, [
          'Estimated Monetization Value (INR Cr)', // Exact original label (stored as-is)
          'estimatedmonetizationvalueinrcr', // Normalized version (also stored)
          'estimated monetization value (inr cr)', // Lowercase version
          'Estimated Monetization Value (INR Cr)'.toLowerCase(), // Lowercase exact
          'estimatedmonetizationvalue',
          'estimatedvalue',
          'monetizationvalue',
          'estimated monetization value',
          'estimated value',
          'monetization value',
          'total estimated monetization value',
          'estimated monetization value (inr crore)',
          'estimated monetization value (inr-crore)',
          'Estimated Monetization (INR-CRORE)',
          'estimatedmonetizationinrcrore'
        ]);
        
        this.logger.debug(`🔍 Indicator 1.2 - Actual Utilization: ${actualUtilization}, Estimated Monetization Value: ${estimatedMonetizationValue}`);
        
        const A1 = estimatedMonetizationValue > 0 ? (actualUtilization / estimatedMonetizationValue) * 100 : 0;
        const A2 = A1 / 2;
        const score = Math.min(A2 * 1.5, 75); // 1.5 marks per 2%

        this.logger.debug(`🔍 Indicator 1.2 - A1: ${A1}%, A2: ${A2}, Score: ${score}`);

        return {
          indicator: '1.2 Asset Monetization Pipeline Utilization',
          value: A1,
          weight: 0.075,
          score,
          maxScore: 75,
        };
      }
      case '1.3': {
        // Any special Financing Mechanism
        // If Yes: Full Marks (75), If No: 0 Marks
        // If "No document available" is present, score is 0 regardless of Yes/No
        if (this.hasNoDocumentAvailable(section)) {
          this.logger.debug(`🔍 Indicator 1.3 - No document available, score = 0`);
          return {
            indicator: '1.3 Any special Financing Mechanism',
            value: 0,
            weight: 0.075,
            score: 0,
            maxScore: 75,
          };
        }
        
        const hasSpecialFinancing = this.getBooleanValue(section, [
          'Yes/No', // Exact field name from form
          'yesno', // Normalized version
          'yes/no', // Lowercase version
          'Yes/No'.toLowerCase(), // Lowercase exact
          'Any special Financing Mechanism', // Exact original label
          'anyspecialfinancingmechanism', // Normalized version
          'any special financing mechanism', // Lowercase version
          'Any special Financing Mechanism'.toLowerCase(), // Lowercase exact
          'hasspecialfinancing',
          'specialfinancing',
          'hasfinancingmechanism',
          'financingmechanism',
          'has special financing',
          'special financing mechanism',
          'has special financing mechanism'
        ]);
        
        this.logger.debug(`🔍 Indicator 1.3 - Has Special Financing: ${hasSpecialFinancing}`);
        
        const score = hasSpecialFinancing ? 75 : 0;

        return {
          indicator: '1.3 Any special Financing Mechanism',
          value: hasSpecialFinancing ? 1 : 0,
          weight: 0.075,
          score,
          maxScore: 75,
        };
      }
      default:
        throw new Error(`Unknown indicator code: ${indicatorCode} for category infraFinancing`);
    }
  }

  // 2. INFRA DEVELOPMENT CALCULATIONS (250 marks)
  private calculateInfraDevelopmentScore(
    formData: Record<string, any>,
    calculations: MinistryScoreCalculation[]
  ): number {
    let categoryScore = 0;

    ['2.1', '2.2', '2.3', '2.4', '2.5'].forEach(code => {
      const calc = this.calculateInfraDevelopmentIndicator(code, formData);
      calculations.push(calc);
      categoryScore += calc.score;
    });

    return categoryScore;
  }

  private calculateInfraDevelopmentIndicator(
    indicatorCode: string,
    formData: Record<string, any>
  ): MinistryScoreCalculation {
    const sectionKey = `section${indicatorCode.replace('.', '_')}`;
    const section = formData.infraDevelopment?.[sectionKey] || {};

    switch (indicatorCode) {
      case '2.1': {
        // Availability of Infrastructure Development Plan
        // If Yes: Full Marks (50), If No: 0 Marks
        // If "No document available" is present, score is 0 regardless of Yes/No
        if (this.hasNoDocumentAvailable(section)) {
          this.logger.debug(`🔍 Indicator 2.1 - No document available, score = 0`);
          return {
            indicator: '2.1 Availability of Infrastructure Development Plan',
            value: 0,
            weight: 0.05,
            score: 0,
            maxScore: 50,
          };
        }
        
        const hasInfraPlan = this.getBooleanValue(section, [
          'Yes/No', // Exact field name from form
          'yesno', // Normalized version
          'yes/no', // Lowercase version
          'Yes/No'.toLowerCase(), // Lowercase exact
          'Availability of Infrastructure Development Plan', // Exact original label
          'availabilityofinfrastructuredvelopmentplan', // Normalized version
          'availability of infrastructure development plan', // Lowercase version
          'Availability of Infrastructure Development Plan'.toLowerCase(), // Lowercase exact
          'hasinfraplan',
          'hasinfrastructureplan',
          'infrastructureplan',
          'hasplan',
          'has infra plan',
          'has infrastructure plan',
          'infrastructure development plan',
          'Has Infrastructure Development Plan?',
          'hasinfrastructuredvelopmentplan'
        ]);
        
        this.logger.debug(`🔍 Indicator 2.1 - Has Infrastructure Plan: ${hasInfraPlan}`);
        
        const score = hasInfraPlan ? 50 : 0;

        return {
          indicator: '2.1 Availability of Infrastructure Development Plan',
          value: hasInfraPlan ? 1 : 0,
          weight: 0.05,
          score,
          maxScore: 50,
        };
      }
      case '2.2': {
        // Investment Ready Projects
        // If Yes: Full Marks (50), If No: 0 Marks
        // If "No document available" is present, score is 0 regardless of Yes/No
        if (this.hasNoDocumentAvailable(section)) {
          this.logger.debug(`🔍 Indicator 2.2 - No document available, score = 0`);
          return {
            indicator: '2.2 Investment Ready Projects',
            value: 0,
            weight: 0.05,
            score: 0,
            maxScore: 50,
          };
        }
        
        const hasInvestmentReady = this.getBooleanValue(section, [
          'Yes/No', // Exact field name from form
          'yesno', // Normalized version
          'yes/no', // Lowercase version
          'Yes/No'.toLowerCase(), // Lowercase exact
          'Investment Ready Projects', // Exact original label
          'investmentreadyprojects', // Normalized version
          'investment ready projects', // Lowercase version
          'Investment Ready Projects'.toLowerCase(), // Lowercase exact
          'hasinvestmentready',
          'investmentready',
          'hasinvestmentreadyprojects',
          'investmentreadyprojects',
          'has investment ready',
          'investment ready',
          'has investment ready projects',
          'Investment Ready Project Pipeline',
          'investmentreadyprojectpipeline',
          'Has Investment Ready Project Pipeline?',
          'hasinvestmentreadyprojectpipeline'
        ]);
        
        this.logger.debug(`🔍 Indicator 2.2 - Has Investment Ready: ${hasInvestmentReady}`);
        
        const score = hasInvestmentReady ? 50 : 0;

        return {
          indicator: '2.2 Investment Ready Projects',
          value: hasInvestmentReady ? 1 : 0,
          weight: 0.05,
          score,
          maxScore: 50,
        };
      }
      case '2.3': {
        // Use of program-based approach for project development
        // If Yes: Full Marks (50), If No: 0 Marks
        // If "No document available" is present, score is 0 regardless of Yes/No
        if (this.hasNoDocumentAvailable(section)) {
          this.logger.debug(`🔍 Indicator 2.3 - No document available, score = 0`);
          return {
            indicator: '2.3 Use of program-based approach for project development',
            value: 0,
            weight: 0.05,
            score: 0,
            maxScore: 50,
          };
        }
        
        const hasProgramBasedApproach = this.getBooleanValue(section, [
          'Yes/No', // Exact field name from form
          'yesno', // Normalized version
          'yes/no', // Lowercase version
          'Yes/No'.toLowerCase(), // Lowercase exact
          'Use of program-based approach for project development', // Exact original label
          'useofprogrambasedapproachforprojectdevelopment', // Normalized version
          'use of program-based approach for project development', // Lowercase version
          'Use of program-based approach for project development'.toLowerCase(), // Lowercase exact
          'hasprogrambasedapproach',
          'programbasedapproach',
          'hasprogramapproach',
          'programapproach',
          'has program based approach',
          'program based approach',
          'has program approach',
          'program approach'
        ]);
        
        this.logger.debug(`🔍 Indicator 2.3 - Has Program Based Approach: ${hasProgramBasedApproach}`);
        
        const score = hasProgramBasedApproach ? 50 : 0;

        return {
          indicator: '2.3 Use of program-based approach for project development',
          value: hasProgramBasedApproach ? 1 : 0,
          weight: 0.05,
          score,
          maxScore: 50,
        };
      }
      case '2.4': {
        // Availability of Model Concession Agreement for PPP project
        // If Yes: Full Marks (50), If No: 0 Marks
        // If "No document available" is present, score is 0 regardless of Yes/No
        if (this.hasNoDocumentAvailable(section)) {
          this.logger.debug(`🔍 Indicator 2.4 - No document available, score = 0`);
          return {
            indicator: '2.4 Availability of Model Concession Agreement for PPP project',
            value: 0,
            weight: 0.05,
            score: 0,
            maxScore: 50,
          };
        }
        
        const hasMCA = this.getBooleanValue(section, [
          'Yes/No', // Exact field name from form
          'yesno', // Normalized version
          'yes/no', // Lowercase version
          'Yes/No'.toLowerCase(), // Lowercase exact
          'Availability of Model Concession Agreement for PPP project', // Exact original label
          'availabilityofmodelconcessionagreementforpppproject', // Normalized version
          'availability of model concession agreement for ppp project', // Lowercase version
          'Availability of Model Concession Agreement for PPP project'.toLowerCase(), // Lowercase exact
          'hasmca',
          'hasmodelconcessionagreement',
          'modelconcessionagreement',
          'mca',
          'has mca',
          'model concession agreement',
          'has model concession agreement',
          'model concession agreement for ppp',
          'mca for ppp'
        ]);
        
        this.logger.debug(`🔍 Indicator 2.4 - Has MCA: ${hasMCA}`);
        
        const score = hasMCA ? 50 : 0;

        return {
          indicator: '2.4 Availability of Model Concession Agreement for PPP project',
          value: hasMCA ? 1 : 0,
          weight: 0.05,
          score,
          maxScore: 50,
        };
      }
      case '2.5': {
        // Percentage of PPP projects to Total project in NIP (by value)
        // P = (A1 / A2) * 100
        // Score = 1 mark for every 1%, Max 50
        const pppProjectsValue = this.getNumericValue(section, [
          'Total Project Cost of PPP infra projects awarded', // Exact field name from form
          'totalprojectcostofpppinfraprojectsawarded', // Normalized version
          'total project cost of ppp infra projects awarded', // Lowercase version
          'Total Project Cost of PPP infra projects awarded'.toLowerCase(), // Lowercase exact
          'PPP Projects Value', // Original label
          'pppprojectsvalue', // Normalized version
          'ppp projects value', // Lowercase version
          'PPP Projects Value'.toLowerCase(), // Lowercase exact
          'pppprojectcost',
          'ppptotalprojectcost',
          'ppptpc',
          'ppp projects cost',
          'ppp total project cost',
          'total ppp projects value',
          'PPP Projects Value (INR Cr)',
          'pppprojectsvalueinrcr'
        ]);
        const totalProjectsValue = this.getNumericValue(section, [
          'Total Project Cost of all infra projects of the Central ministry awarded', // Exact field name from form
          'totalprojectcostofallinfraprojectsofthecentralministryawarded', // Normalized version
          'total project cost of all infra projects of the central ministry awarded', // Lowercase version
          'Total Project Cost of all infra projects of the Central ministry awarded'.toLowerCase(), // Lowercase exact
          'Total Projects Value', // Original label
          'totalprojectsvalue', // Normalized version
          'total projects value', // Lowercase version
          'Total Projects Value'.toLowerCase(), // Lowercase exact
          'totalprojectcost',
          'totalnipvalue',
          'totalvalue',
          'total projects cost',
          'total nip value',
          'total value',
          'Total Projects Value in NIP',
          'totalprojectsvalueinnip',
          'Total NIP Value',
          'totalnipvalue'
        ]);
        
        this.logger.debug(`🔍 Indicator 2.5 - PPP Projects Value: ${pppProjectsValue}, Total Projects Value: ${totalProjectsValue}`);
        
        const percentage = totalProjectsValue > 0 ? (pppProjectsValue / totalProjectsValue) * 100 : 0;
        const score = Math.min(percentage * 1, 50); // 1 mark per 1%

        this.logger.debug(`🔍 Indicator 2.5 - Percentage: ${percentage}%, Score: ${score}`);

        return {
          indicator: '2.5 Percentage of PPP projects to Total project in NIP (by value)',
          value: percentage,
          weight: 0.05,
          score,
          maxScore: 50,
        };
      }
      default:
        throw new Error(`Unknown indicator code: ${indicatorCode} for category infraDevelopment`);
    }
  }

  // 3. PPP DEVELOPMENT CALCULATIONS (250 marks)
  private calculatePPPDevelopmentScore(
    formData: Record<string, any>,
    calculations: MinistryScoreCalculation[]
  ): number {
    let categoryScore = 0;

    ['3.1', '3.2', '3.3'].forEach(code => {
      const calc = this.calculatePPPDevelopmentIndicator(code, formData);
      calculations.push(calc);
      categoryScore += calc.score;
    });

    return categoryScore;
  }

  private calculatePPPDevelopmentIndicator(
    indicatorCode: string,
    formData: Record<string, any>
  ): MinistryScoreCalculation {
    const sectionKey = `section${indicatorCode.replace('.', '_')}`;
    const section = formData.pppDevelopment?.[sectionKey] || {};

    switch (indicatorCode) {
      case '3.1': {
        // Availability of Policy directives for promoting PPP
        // If Yes: Full Marks (50), If No: 0 Marks
        // If "No document available" is present, score is 0 regardless of Yes/No
        if (this.hasNoDocumentAvailable(section)) {
          this.logger.debug(`🔍 Indicator 3.1 - No document available, score = 0`);
          return {
            indicator: '3.1 Availability of Policy directives for promoting PPP',
            value: 0,
            weight: 0.05,
            score: 0,
            maxScore: 50,
          };
        }
        
        const hasPolicyDirectives = this.getBooleanValue(section, [
          'Yes/No', // Exact field name from form
          'yesno', // Normalized version
          'yes/no', // Lowercase version
          'Yes/No'.toLowerCase(), // Lowercase exact
          'Availability of Policy directives for promoting PPP', // Exact original label
          'availabilityofpolicydirectivesforpromotingppp', // Normalized version
          'availability of policy directives for promoting ppp', // Lowercase version
          'Availability of Policy directives for promoting PPP'.toLowerCase(), // Lowercase exact
          'haspolicydirectives',
          'policydirectives',
          'hasppppolicy',
          'ppppolicy',
          'has policy directives',
          'policy directives',
          'has ppp policy',
          'ppp policy',
          'policy directives for ppp'
        ]);
        
        this.logger.debug(`🔍 Indicator 3.1 - Has Policy Directives: ${hasPolicyDirectives}`);
        
        const score = hasPolicyDirectives ? 50 : 0;

        return {
          indicator: '3.1 Availability of Policy directives for promoting PPP',
          value: hasPolicyDirectives ? 1 : 0,
          weight: 0.05,
          score,
          maxScore: 50,
        };
      }
      case '3.2': {
        // Proposals submitted under VGF/IIPDF
        // 7.5 marks for each project, Max 75
        const proposalsArray = this.getArrayValue(section, [
          'Proposals submitted under VGF/IIPDF', // Exact original label
          'proposalssubmittedundervgfiipdf', // Normalized version
          'proposals submitted under vgf/iipdf', // Lowercase version
          'Proposals submitted under VGF/IIPDF'.toLowerCase(), // Lowercase exact
          'proposals',
          'vgfproposals',
          'iipdfproposals',
          'vgfiipdfproposals',
          'vgf proposals',
          'iipdf proposals',
          'vgf/iipdf proposals',
          'proposals list',
          'proposal array'
        ]);
        
        this.logger.debug(`🔍 Indicator 3.2 - Found ${proposalsArray.length} proposals`);
        
        const validProposals = proposalsArray.filter(item => {
          if (!item) return false;
          // Check if proposal has required fields
          return this.hasValidProposal(item);
        }).length;
        
        this.logger.debug(`🔍 Indicator 3.2 - Valid proposals: ${validProposals}`);
        
        const score = Math.min(validProposals * 7.5, 75);

        return {
          indicator: '3.2 Proposals submitted under VGF/IIPDF',
          value: validProposals,
          weight: 0.075,
          score,
          maxScore: 75,
        };
      }
      case '3.3': {
        // Proportion of TPC of PPP Projects
        // Total of all TPC of all PPP Projects = Sum of TPC
        // Proportion = (Total TPC of PPP Projects / Total Budgeted capital allocation) * 100
        // Score = 2 marks for every 1%, Max 100
        const totalTPC = this.getNumericValue(section, [
          'Total of all TPC of all PPP Projects (INR Crore)', // Exact original label from form
          'totalofalltpcofallpppprojectsinrcrore', // Normalized version (from formData)
          'Total of all TPC of all PPP Projects (INR Crore)'.toLowerCase(), // Lowercase exact
          'Total TPC of PPP Projects', // Alternative label
          'totaltpcofpppprojects', // Normalized version
          'total tpc of ppp projects', // Lowercase version
          'Total TPC of PPP Projects'.toLowerCase(), // Lowercase exact
          'totaltpc',
          'totalppptpc',
          'totalprojectcost',
          'sumoftpc',
          'total tpc',
          'total ppp tpc',
          'total project cost',
          'sum of tpc',
          'Total TPC (INR Cr)',
          'totaltpcinrcr'
        ]);
        const totalBudgetedCapital = this.getNumericValue(section, [
          'Total Budgeted capital allocation (INR Crore)', // Exact original label from form
          'totalbudgetedcapitalallocationinrcrore', // Normalized version (from formData)
          'Total Budgeted capital allocation (INR Crore)'.toLowerCase(), // Lowercase exact
          'Total Budgeted capital allocation', // Alternative label (without suffix)
          'totalbudgetedcapitalallocation', // Normalized version
          'total budgeted capital allocation', // Lowercase version
          'Total Budgeted capital allocation'.toLowerCase(), // Lowercase exact
          'totalbudgetedcapital',
          'budgetedcapitalallocation',
          'totalcapitalallocation',
          'budgetedcapital',
          'total budgeted capital',
          'budgeted capital allocation',
          'total capital allocation',
          'Total Budgeted Capital Allocation (INR Cr)',
          'totalbudgetedcapitalallocationinrcr'
        ]);
        
        this.logger.debug(`🔍 Indicator 3.3 - Total TPC: ${totalTPC}, Total Budgeted Capital: ${totalBudgetedCapital}`);
        
        const proportion = totalBudgetedCapital > 0 ? (totalTPC / totalBudgetedCapital) * 100 : 0;
        const score = Math.min(proportion * 2, 100); // 2 marks per 1%

        this.logger.debug(`🔍 Indicator 3.3 - Proportion: ${proportion}%, Score: ${score}`);

        return {
          indicator: '3.3 Proportion of TPC of PPP Projects',
          value: proportion,
          weight: 0.1,
          score,
          maxScore: 100,
        };
      }
      default:
        throw new Error(`Unknown indicator code: ${indicatorCode} for category pppDevelopment`);
    }
  }

  // 4. INFRA ENABLERS CALCULATIONS (250 marks)
  private calculateInfraEnablersScore(
    formData: Record<string, any>,
    calculations: MinistryScoreCalculation[]
  ): number {
    let categoryScore = 0;

    ['4.1', '4.2', '4.3', '4.4', '4.5'].forEach(code => {
      const calc = this.calculateInfraEnablersIndicator(code, formData);
      calculations.push(calc);
      categoryScore += calc.score;
    });

    return categoryScore;
  }

  private calculateInfraEnablersIndicator(
    indicatorCode: string,
    formData: Record<string, any>
  ): MinistryScoreCalculation {
    const sectionKey = `section${indicatorCode.replace('.', '_')}`;
    const section = formData.infraEnablers?.[sectionKey] || {};

    switch (indicatorCode) {
      case '4.1': {
        // Availability and use of high-level Project Monitoring System
        // If Yes: Full Marks (70), If No: 0 Marks
        // If "No document available" is present, score is 0 regardless of Yes/No
        if (this.hasNoDocumentAvailable(section)) {
          this.logger.debug(`🔍 Indicator 4.1 - No document available, score = 0`);
          return {
            indicator: '4.1 Availability and use of high-level Project Monitoring System',
            value: 0,
            weight: 0.07,
            score: 0,
            maxScore: 70,
          };
        }
        
        const hasMonitoringSystem = this.getBooleanValue(section, [
          'Yes/No', // Exact field name from form
          'yesno', // Normalized version
          'yes/no', // Lowercase version
          'Yes/No'.toLowerCase(), // Lowercase exact
          'Availability and use of high-level Project Monitoring System', // Exact original label
          'availabilityanduseofhighlevelprojectmonitoringsystem', // Normalized version
          'availability and use of high-level project monitoring system', // Lowercase version
          'Availability and use of high-level Project Monitoring System'.toLowerCase(), // Lowercase exact
          'hasmonitoringsystem',
          'hasprojectmonitoringsystem',
          'monitoringsystem',
          'projectmonitoring',
          'has monitoring system',
          'project monitoring system',
          'has project monitoring system',
          'high-level project monitoring system'
        ]);
        
        this.logger.debug(`🔍 Indicator 4.1 - Has Monitoring System: ${hasMonitoringSystem}`);
        
        const score = hasMonitoringSystem ? 70 : 0;

        return {
          indicator: '4.1 Availability and use of high-level Project Monitoring System',
          value: hasMonitoringSystem ? 1 : 0,
          weight: 0.07,
          score,
          maxScore: 70,
        };
      }
      case '4.2': {
        // Adoption of PM GatiShakti National Master Plan in infrastructure planning
        // 10 marks for each project planned through PM GatiShakti, Max 30
        // If "No document available" is present, score is 0 regardless of Yes/No
        if (this.hasNoDocumentAvailable(section)) {
          this.logger.debug(`🔍 Indicator 4.2 - No document available, score = 0`);
          return {
            indicator: '4.2 Adoption of PM GatiShakti National Master Plan',
            value: 0,
            weight: 0.03,
            score: 0,
            maxScore: 30,
          };
        }
        
        const hasAdoptedGatiShakti = this.getBooleanValue(section, [
          'Yes/No', // Exact field name from form
          'yesno', // Normalized version
          'yes/no', // Lowercase version
          'Yes/No'.toLowerCase(), // Lowercase exact
          'Adoption of PM GatiShakti National Master Plan', // Alternative label
          'adoptionofpmgatishaktinationalmasterplan', // Normalized version
          'adoption of pm gatishakti national master plan', // Lowercase version
          'Adoption of PM GatiShakti National Master Plan'.toLowerCase(), // Lowercase exact
          'hasadoptedgatishakti',
          'adoptedgatishakti',
          'hasgatishakti',
          'gatishakti',
          'has adopted gati shakti',
          'adopted gati shakti',
          'has gati shakti',
          'gati shakti'
        ]);
        
        if (!hasAdoptedGatiShakti) {
          this.logger.debug(`🔍 Indicator 4.2 - Not adopted, score = 0`);
          return {
            indicator: '4.2 Adoption of PM GatiShakti National Master Plan',
            value: 0,
            weight: 0.03,
            score: 0,
            maxScore: 30,
          };
        }
        
        const projectsArray = this.getArrayValue(section, [
          'proposals', // Generic key for subsection data (stored by transformMinistryDataToFormDataForIndicator)
          'Proposals submitted under VGF/IIPDF', // Alternative key
          'proposalssubmittedundervgfiipdf', // Normalized version
          'Adoption of PM GatiShakti National Master Plan', // Alternative label
          'adoptionofpmgatishaktinationalmasterplan', // Normalized version
          'adoption of pm gatishakti national master plan', // Lowercase version
          'Adoption of PM GatiShakti National Master Plan'.toLowerCase(), // Lowercase exact
          'projects',
          'gatishaktiprojects',
          'pmgatishaktiprojects',
          'plannedprojects',
          'gati shakti projects',
          'pm gati shakti projects',
          'planned projects',
          'projects list',
          'project array'
        ]);
        
        this.logger.debug(`🔍 Indicator 4.2 - Found ${projectsArray.length} projects`);
        
        const validProjects = projectsArray.filter(item => {
          if (!item) return false;
          
          // Check if "No document available" is present in this proposal
          const noDocumentValue = this.getValue(item, [
            'No Document Available',
            'nodocumentavailable',
            'no document available',
            'No Document Available'.toLowerCase(),
            'nodocument',
            'no document',
            'document not available',
            'documentnotavailable'
          ]);
          
          if (noDocumentValue && typeof noDocumentValue === 'string') {
            const str = noDocumentValue.toLowerCase().trim();
            const noDocumentIndicators = [
              'no document available',
              'nodocumentavailable',
              'no document',
              'nodocument',
              'document not available',
              'documentnotavailable',
              'n/a',
              'na',
              'not available',
              'notavailable'
            ];
            
            if (noDocumentIndicators.includes(str)) {
              this.logger.debug(`⚠️ Indicator 4.2 - Proposal has "No document available", excluding from score`);
              return false;
            }
          }
          
          // Check if project is planned through PM GatiShakti
          return this.hasValidGatiShaktiProject(item);
        }).length;
        
        this.logger.debug(`🔍 Indicator 4.2 - Valid GatiShakti projects: ${validProjects}`);
        
        const score = Math.min(validProjects * 10, 30);

        return {
          indicator: '4.2 Adoption of PM GatiShakti National Master Plan',
          value: validProjects,
          weight: 0.03,
          score,
          maxScore: 30,
        };
      }
      case '4.3': {
        // Adoption of ADR
        // If Yes: Full Marks (50), If No: 0 Marks
        // If "No document available" is present, score is 0 regardless of Yes/No
        if (this.hasNoDocumentAvailable(section)) {
          this.logger.debug(`🔍 Indicator 4.3 - No document available, score = 0`);
          return {
            indicator: '4.3 Adoption of ADR',
            value: 0,
            weight: 0.05,
            score: 0,
            maxScore: 50,
          };
        }
        
        const hasAdoptedADR = this.getBooleanValue(section, [
          'Yes/No', // Exact field name from form
          'yesno', // Normalized version
          'yes/no', // Lowercase version
          'Yes/No'.toLowerCase(), // Lowercase exact
          'Adoption of ADR', // Exact original label
          'adoptionofadr', // Normalized version
          'adoption of adr', // Lowercase version
          'Adoption of ADR'.toLowerCase(), // Lowercase exact
          'hasadoptedadr',
          'adoptedadr',
          'hasadr',
          'adr',
          'has adopted adr',
          'adopted adr',
          'has adr',
          'alternative dispute resolution'
        ]);
        
        this.logger.debug(`🔍 Indicator 4.3 - Has Adopted ADR: ${hasAdoptedADR}`);
        
        const score = hasAdoptedADR ? 50 : 0;

        return {
          indicator: '4.3 Adoption of ADR',
          value: hasAdoptedADR ? 1 : 0,
          weight: 0.05,
          score,
          maxScore: 50,
        };
      }
      case '4.4': {
        // Innovative Practices
        // 10 Marks for each practice, Max 50
        // If "No document available" is present, score is 0 regardless of Yes/No
        if (this.hasNoDocumentAvailable(section)) {
          this.logger.debug(`🔍 Indicator 4.4 - No document available, score = 0`);
          return {
            indicator: '4.4 Innovative Practices',
            value: 0,
            weight: 0.05,
            score: 0,
            maxScore: 50,
          };
        }
        
        const hasInnovativePractices = this.getBooleanValue(section, [
          'Yes/No', // Exact field name from form
          'yesno', // Normalized version
          'yes/no', // Lowercase version
          'Yes/No'.toLowerCase(), // Lowercase exact
          'Innovative Practices', // Alternative label
          'innovativepractices', // Normalized version
          'innovative practices', // Lowercase version
          'Innovative Practices'.toLowerCase(), // Lowercase exact
          'hasinnovativepractices',
          'innovativepractices',
          'has practices',
          'practices'
        ]);
        
        if (!hasInnovativePractices) {
          this.logger.debug(`🔍 Indicator 4.4 - Not adopted, score = 0`);
          return {
            indicator: '4.4 Innovative Practices',
            value: 0,
            weight: 0.05,
            score: 0,
            maxScore: 50,
          };
        }
        
        const practicesArray = this.getArrayValue(section, [
          'proposals', // Generic key for subsection data (stored by transformMinistryDataToFormDataForIndicator)
          'Proposals submitted under VGF/IIPDF', // Alternative key
          'proposalssubmittedundervgfiipdf', // Normalized version
          'Innovative Practices', // Alternative label
          'innovativepractices', // Normalized version
          'innovative practices', // Lowercase version
          'Innovative Practices'.toLowerCase(), // Lowercase exact
          'practices',
          'innovativepractices',
          'practicelist',
          'practice list',
          'innovative practices list',
          'practices array'
        ]);
        
        this.logger.debug(`🔍 Indicator 4.4 - Found ${practicesArray.length} practices`);
        
        const validPractices = practicesArray.filter(item => {
          if (!item) return false;
          
          // Check if "No document available" is present in this practice
          const noDocumentValue = this.getValue(item, [
            'No Document Available',
            'nodocumentavailable',
            'no document available',
            'No Document Available'.toLowerCase(),
            'nodocument',
            'no document',
            'document not available',
            'documentnotavailable'
          ]);
          
          if (noDocumentValue && typeof noDocumentValue === 'string') {
            const str = noDocumentValue.toLowerCase().trim();
            const noDocumentIndicators = [
              'no document available',
              'nodocumentavailable',
              'no document',
              'nodocument',
              'document not available',
              'documentnotavailable',
              'n/a',
              'na',
              'not available',
              'notavailable'
            ];
            
            if (noDocumentIndicators.includes(str)) {
              this.logger.debug(`⚠️ Indicator 4.4 - Practice has "No document available", excluding from score`);
              return false;
            }
          }
          
          // Check if practice has required fields
          return this.hasValidPractice(item);
        }).length;
        
        this.logger.debug(`🔍 Indicator 4.4 - Valid practices: ${validPractices}`);
        
        const score = Math.min(validPractices * 10, 50);

        return {
          indicator: '4.4 Innovative Practices',
          value: validPractices,
          weight: 0.05,
          score,
          maxScore: 50,
        };
      }
      case '4.5': {
        // Infra-Focused Trainings
        // 1 mark for each officer participation, Max 50
        // Only count trainings in the current financial year
        const trainingsArray = this.getArrayValue(section, [
          'proposals', // Generic key for subsection data (stored by transformMinistryDataToFormDataForIndicator)
          'Proposals submitted under VGF/IIPDF', // Alternative key
          'proposalssubmittedundervgfiipdf', // Normalized version
          'Infra-Focused Trainings', // Alternative label
          'infrafocusedtrainings', // Normalized version
          'infra-focused trainings', // Lowercase version
          'Infra-Focused Trainings'.toLowerCase(), // Lowercase exact
          'trainings',
          'officertrainings',
          'trainingparticipations',
          'participations',
          'officer trainings',
          'training participations',
          'infra focused trainings',
          'trainings list',
          'training array'
        ]);
        
        this.logger.debug(`🔍 Indicator 4.5 - Found ${trainingsArray.length} trainings`);
        
        // Get current financial year
        const currentFY = this.getCurrentFinancialYear();
        this.logger.debug(`🔍 Indicator 4.5 - Current Financial Year: ${currentFY}`);
        
        // Filter entries that belong to current financial year
        const validTrainings = trainingsArray.filter(item => {
          if (!item) return false;
          
          // Check if training has required fields first
          if (!this.hasValidTraining(item)) {
            return false;
          }
          
          // Get training period (could be date format YYYY-MM-DD or MM/YY format)
          const trainingPeriod = this.getValue(item, [
            'Training Period (MM/YY)',
            'trainingperiodmmyy',
            'training period (mm/yy)',
            'Training Period (MM/YY)'.toLowerCase(),
            'trainingPeriod',
            'trainingperiod',
            'period',
            'date'
          ]);
          
          if (!trainingPeriod) {
            this.logger.debug(`⚠️ Indicator 4.5 - Training entry missing training period`);
            return false;
          }
          
          const trainingPeriodStr = String(trainingPeriod).trim();
          
          // Try to parse as date first (YYYY-MM-DD format)
          let month: number;
          let fullYear: number;
          
          if (trainingPeriodStr.includes('-') && trainingPeriodStr.length >= 7) {
            // Date format: YYYY-MM-DD or YYYY-MM
            const dateParts = trainingPeriodStr.split('-');
            if (dateParts.length >= 2) {
              fullYear = parseInt(dateParts[0], 10);
              month = parseInt(dateParts[1], 10);
            } else {
              this.logger.debug(`⚠️ Indicator 4.5 - Invalid date format: ${trainingPeriodStr}`);
              return false;
            }
          } else if (trainingPeriodStr.includes('/') && trainingPeriodStr.length === 5) {
            // MM/YY format
            const [monthStr, yearStr] = trainingPeriodStr.split('/');
            month = parseInt(monthStr, 10);
            const yearShort = parseInt(yearStr, 10);
            
            if (isNaN(month) || isNaN(yearShort) || month < 1 || month > 12) {
              this.logger.debug(`⚠️ Indicator 4.5 - Invalid MM/YY format: ${trainingPeriodStr}`);
              return false;
            }
            
            // Convert YY to full year (assuming 2000-2099 range)
            fullYear = 2000 + yearShort;
          } else {
            this.logger.debug(`⚠️ Indicator 4.5 - Unrecognized training period format: ${trainingPeriodStr}`);
            return false;
          }
          
          if (isNaN(month) || isNaN(fullYear) || month < 1 || month > 12) {
            this.logger.debug(`⚠️ Indicator 4.5 - Invalid month/year: month=${month}, year=${fullYear}`);
            return false;
          }
          
          // Determine financial year for this training period
          // FY runs from April (04) to March (03)
          let entryFY: string;
          if (month >= 4) {
            // April onwards belongs to current year - next year
            const nextYearShort = ((fullYear + 1) % 100).toString().padStart(2, '0');
            entryFY = `${fullYear}-${nextYearShort}`;
          } else {
            // Jan-Mar belongs to previous year - current year
            const prevYear = fullYear - 1;
            const currYearShort = (fullYear % 100).toString().padStart(2, '0');
            entryFY = `${prevYear}-${currYearShort}`;
          }
          
          // Only count if it matches current financial year
          const isCurrentFY = entryFY === currentFY;
          this.logger.debug(`🔍 Indicator 4.5 - Training period: ${trainingPeriodStr}, FY: ${entryFY}, Current FY: ${currentFY}, Match: ${isCurrentFY}`);
          
          return isCurrentFY;
        }).length;
        
        this.logger.debug(`🔍 Indicator 4.5 - Valid trainings (current FY): ${validTrainings}`);
        
        const score = Math.min(validTrainings * 1, 50);

        return {
          indicator: '4.5 Infra-Focused Trainings',
          value: validTrainings,
          weight: 0.05,
          score,
          maxScore: 50,
        };
      }
      default:
        throw new Error(`Unknown indicator code: ${indicatorCode} for category infraEnablers`);
    }
  }

  // Helper methods
  private getValue(section: any, possibleKeys: string[]): any {
    if (!section || typeof section !== 'object') {
      this.logger.debug(`⚠️ getValue: section is null or not an object`);
      return null;
    }
    
    const sectionKeys = Object.keys(section);
    this.logger.debug(`🔍 getValue: Searching for keys: ${possibleKeys.slice(0, 3).join(', ')}... in section with keys: ${sectionKeys.slice(0, 5).join(', ')}...`);
    
    // FIRST: Try exact key matches (no normalization) - fastest and most reliable
    for (const key of possibleKeys) {
      if (section[key] !== undefined && section[key] !== null) {
        this.logger.debug(`✅ getValue: Found using exact key match "${key}" = ${section[key]}`);
        return section[key];
      }
    }
    
    // SECOND: Try normalized key matches
    for (const key of possibleKeys) {
      const normalizedKey = this.normalizeFieldName(key);
      if (section[normalizedKey] !== undefined && section[normalizedKey] !== null) {
        this.logger.debug(`✅ getValue: Found using normalized key "${normalizedKey}" (from "${key}") = ${section[normalizedKey]}`);
        return section[normalizedKey];
      }
    }
    
    // THIRD: Try matching against all keys in section (normalized comparison)
    for (const sectionKey of sectionKeys) {
      const normalizedSectionKey = this.normalizeFieldName(sectionKey);
      
      for (const key of possibleKeys) {
        const normalizedKey = this.normalizeFieldName(key);
        
        // Exact normalized match
        if (normalizedSectionKey === normalizedKey) {
          this.logger.debug(`✅ getValue: Found using normalized match "${sectionKey}" (normalized: "${normalizedSectionKey}") matches "${key}" (normalized: "${normalizedKey}") = ${section[sectionKey]}`);
          return section[sectionKey];
        }
      }
    }
    
    // Log what we were looking for and what's available
    this.logger.debug(`⚠️ getValue: No match found for keys: ${possibleKeys.slice(0, 5).join(', ')}...`);
    this.logger.debug(`⚠️ getValue: Available section keys: ${sectionKeys.slice(0, 10).join(', ')}...`);
    
    return null;
  }

  private getNumericValue(section: any, possibleKeys: string[]): number {
    const value = this.getValue(section, possibleKeys);
    if (value === null || value === undefined) return 0;
    const num = parseFloat(String(value));
    return isNaN(num) ? 0 : num;
  }

  private getBooleanValue(section: any, possibleKeys: string[]): boolean {
    const value = this.getValue(section, possibleKeys);
    if (value === null || value === undefined) return false;
    const str = String(value).toLowerCase().trim();
    return str === 'yes' || str === 'true' || str === '1' || str === 'y';
  }

  /**
   * Check if "No document available" is present in the section
   * If present, returns true (meaning no document was provided)
   */
  private hasNoDocumentAvailable(section: any): boolean {
    if (!section || typeof section !== 'object') return false;
    
    const noDocumentValue = this.getValue(section, [
      'No Document Available', // Exact field name from form
      'nodocumentavailable', // Normalized version
      'no document available', // Lowercase version
      'No Document Available'.toLowerCase(), // Lowercase exact
      'nodocument',
      'no document',
      'documentnotavailable',
      'document not available'
    ]);
    
    if (noDocumentValue === null || noDocumentValue === undefined) {
      return false;
    }
    
    const str = String(noDocumentValue).toLowerCase().trim();
    const noDocumentIndicators = [
      'no document available',
      'nodocumentavailable',
      'no document',
      'nodocument',
      'document not available',
      'documentnotavailable',
      'n/a',
      'na',
      'not available',
      'notavailable'
    ];
    
    const hasNoDocument = noDocumentIndicators.includes(str);
    
    if (hasNoDocument) {
      this.logger.debug(`⚠️ No document available found: "${noDocumentValue}" - Score will be 0`);
    }
    
    return hasNoDocument;
  }

  private getArrayValue(section: any, possibleKeys: string[]): any[] {
    const value = this.getValue(section, possibleKeys);
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') {
      // Try to find array in nested structure
      const keys = Object.keys(value);
      for (const k of keys) {
        if (Array.isArray(value[k])) return value[k];
      }
    }
    return [];
  }

  private hasValidProposal(item: any): boolean {
    // Check if proposal has required fields (adjust based on your form structure)
    return item && (
      item.projectName || 
      item.proposalName || 
      item.file || 
      item.valueJson ||
      (typeof item === 'object' && Object.keys(item).length > 0)
    );
  }

  private hasValidGatiShaktiProject(item: any): boolean {
    // Check if project is planned through PM GatiShakti
    return item && (
      item.projectName || 
      item.isGatiShakti === true || 
      item.isGatiShakti === 'yes' ||
      item.gatiShakti === true ||
      item.gatiShakti === 'yes' ||
      (typeof item === 'object' && Object.keys(item).length > 0)
    );
  }

  private hasValidPractice(item: any): boolean {
    // Check if practice has required fields (adjust based on your form structure)
    return item && (
      item.practiceName || 
      item['Innovative Practice'] ||
      item.innovativePractice ||
      item.innovativepractice ||
      item.description || 
      item['Envisaged Impact'] ||
      item.envisagedImpact ||
      item.envisagedimpact ||
      item.evidence ||
      item.Evidence ||
      item.file || 
      item.valueJson ||
      (typeof item === 'object' && Object.keys(item).length > 0)
    );
  }

  private hasValidTraining(item: any): boolean {
    // Check if training has required fields (adjust based on your form structure)
    return item && (
      item.officerName || 
      item['Officer Name'] ||
      item.officername ||
      item.trainingName || 
      item['Training Program Name'] ||
      item.trainingprogramname ||
      item.participationDate ||
      item['Training Period (MM/YY)'] ||
      item.trainingperiodmmyy ||
      item.officer ||
      item.training ||
      item.designation ||
      item.Designation ||
      (typeof item === 'object' && Object.keys(item).length > 0)
    );
  }

  /**
   * Get current financial year in format "YYYY-YY" (e.g., "2025-26")
   * Financial Year runs from April (04) to March (03)
   */
  private getCurrentFinancialYear(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1; // getMonth() returns 0-11, so add 1

    // If April (4) or later, FY = currentYear-(nextYear % 100)
    // Else FY = (previousYear)-(currentYear % 100)
    if (month >= 4) {
      const nextYearShort = ((year + 1) % 100).toString().padStart(2, '0');
      return `${year}-${nextYearShort}`;
    } else {
      const prevYear = year - 1;
      const currYearShort = (year % 100).toString().padStart(2, '0');
      return `${prevYear}-${currYearShort}`;
    }
  }

  /**
   * Calculate score for a single ministry indicator and save it
   * This is called automatically when ministry submission data is updated
   */
  async calculateIndicatorScore(
    submissionId: string,
    indicatorCode: string,
    category: string,
    formData: Record<string, any>,
    userId?: string,
    updateReason?: string,
    indicatorStatus?: string
  ): Promise<MinistryIndicatorScore> {
    // Debounce: prevent duplicate calculations if multiple updates happen quickly
    const queueKey = `${submissionId}_${indicatorCode}`;
    
    // If there's a pending calculation, cancel it
    if (this.calculationQueue.has(queueKey)) {
      clearTimeout(this.calculationQueue.get(queueKey)!);
      this.calculationQueue.delete(queueKey);
    }

    // Return a promise that will resolve after debounce
    // Increased debounce time to 2 seconds to ensure submission is fully complete
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(async () => {
        try {
          this.calculationQueue.delete(queueKey);
          
          // Additional delay to ensure all database operations are committed
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const result = await this.performIndicatorScoreCalculation(
            submissionId,
            indicatorCode,
            category,
            formData,
            userId,
            updateReason,
            indicatorStatus
          );
          resolve(result);
        } catch (error) {
          this.logger.error(`Error in calculateIndicatorScore: ${error.message}`, error.stack);
          reject(error);
        }
      }, 2000); // 2 second debounce to ensure submission is complete

      this.calculationQueue.set(queueKey, timeout);
    });
  }

  /**
   * Perform the actual indicator score calculation
   */
  private async performIndicatorScoreCalculation(
    submissionId: string,
    indicatorCode: string,
    category: string,
    formData: Record<string, any>,
    userId?: string,
    updateReason?: string,
    indicatorStatus?: string
  ): Promise<MinistryIndicatorScore> {
    this.logger.log(
      `🧮 Calculating ministry score for indicator ${indicatorCode} in category ${category} for submission ${submissionId}`
    );

    // Check if score already exists
    const existingScore = await this.ministryIndicatorScoreRepository.findOne({
      where: { submissionId, indicatorCode },
    });

    // Store previous score for history
    const previousScore = existingScore ? parseFloat(existingScore.score.toString()) : null;

    // Calculate NEW score based on CURRENT formData values
    const calculation = this.calculateSingleIndicatorScore(indicatorCode, category, formData);
    const newScore = calculation.score;

    // Calculate score change
    const scoreChange = previousScore !== null ? newScore - previousScore : null;

    this.logger.log(
      `📈 Ministry score calculation: previous=${previousScore}, new=${newScore}, change=${scoreChange}`
    );

    const scoreData = {
      submissionId,
      indicatorCode,
      category,
      score: newScore,
      maxScore: calculation.maxScore,
      calculation,
    };

    let savedScore: MinistryIndicatorScore;

    if (existingScore) {
      // UPDATE existing score
      this.logger.log(`🔄 Updating existing ministry score record (id: ${existingScore.id})...`);
      existingScore.score = newScore;
      existingScore.maxScore = calculation.maxScore;
      existingScore.category = category;
      existingScore.calculation = calculation;
      savedScore = await this.ministryIndicatorScoreRepository.save(existingScore);
      this.logger.log(
        `✅ Updated ministry score for indicator ${indicatorCode}: ${previousScore} → ${newScore}`
      );
    } else {
      // CREATE new score
      this.logger.log(`➕ Creating new ministry score record...`);
      const indicatorScore = this.ministryIndicatorScoreRepository.create(scoreData);
      savedScore = await this.ministryIndicatorScoreRepository.save(indicatorScore);
      this.logger.log(
        `✅ Created new ministry score for indicator ${indicatorCode}: ${newScore} (id: ${savedScore.id})`
      );
    }

    // ALWAYS create a history record for every score update
    await this.createScoreHistory({
      submissionId,
      indicatorCode,
      category,
      score: newScore,
      maxScore: calculation.maxScore,
      previousScore,
      scoreChange,
      calculation,
      formDataSnapshot: this.getIndicatorFormDataSnapshot(formData, category, indicatorCode),
      updatedBy: userId,
      updateReason: updateReason || 'INDICATOR_UPDATED',
      indicatorStatus,
    });

    return savedScore;
  }

  /**
   * Calculate score for a single indicator (helper method)
   */
  private calculateSingleIndicatorScore(
    indicatorCode: string,
    category: string,
    formData: Record<string, any>
  ): MinistryScoreCalculation {
    switch (category) {
      case 'infraFinancing':
        return this.calculateInfraFinancingIndicator(indicatorCode, formData);
      case 'infraDevelopment':
        return this.calculateInfraDevelopmentIndicator(indicatorCode, formData);
      case 'pppDevelopment':
        return this.calculatePPPDevelopmentIndicator(indicatorCode, formData);
      case 'infraEnablers':
        return this.calculateInfraEnablersIndicator(indicatorCode, formData);
      default:
        throw new Error(`Unknown category: ${category}`);
    }
  }

  /**
   * Create a history record for score update
   */
  private async createScoreHistory(data: {
    submissionId: string;
    indicatorCode: string;
    category: string;
    score: number;
    maxScore: number;
    previousScore: number | null;
    scoreChange: number | null;
    calculation: MinistryScoreCalculation;
    formDataSnapshot: Record<string, any> | null;
    updatedBy?: string | null;
    updateReason?: string | null;
    indicatorStatus?: string | null;
  }): Promise<MinistryIndicatorScoreHistory> {
    const historyRecord = this.ministryIndicatorScoreHistoryRepository.create({
      submissionId: data.submissionId,
      indicatorCode: data.indicatorCode,
      category: data.category,
      score: data.score,
      maxScore: data.maxScore,
      previousScore: data.previousScore,
      scoreChange: data.scoreChange,
      calculation: data.calculation,
      formDataSnapshot: data.formDataSnapshot,
      updatedBy: data.updatedBy,
      updateReason: data.updateReason,
      indicatorStatus: data.indicatorStatus,
    });

    const savedHistory = await this.ministryIndicatorScoreHistoryRepository.save(historyRecord);

    this.logger.log(
      `📝 Created ministry score history record for indicator ${data.indicatorCode}: ` +
      `Score ${data.previousScore ?? 'N/A'} → ${data.score} ` +
      `(Change: ${data.scoreChange ?? 'N/A'}) at ${savedHistory.createdAt}`
    );

    return savedHistory;
  }

  /**
   * Get a snapshot of formData relevant to this indicator
   */
  private getIndicatorFormDataSnapshot(
    formData: Record<string, any>,
    category: string,
    indicatorCode: string
  ): Record<string, any> | null {
    try {
      const sectionKey = `section${indicatorCode.replace('.', '_')}`;
      const categoryData = formData[category];

      if (!categoryData || !categoryData[sectionKey]) {
        return null;
      }

      // Return only the relevant section data
      return {
        [category]: {
          [sectionKey]: categoryData[sectionKey],
        },
      };
    } catch (error) {
      this.logger.warn(`Failed to create formData snapshot: ${error.message}`);
      return null;
    }
  }

  /**
   * Transform ministry submission data to formData structure for a specific indicator
   * This is used by the subscriber and service-level integration
   */
  async transformMinistryDataToFormDataForIndicator(
    submissionIndicatorId: string,
    indicatorId: string
  ): Promise<Record<string, any>> {
    // Get all submission data for this indicator
    const submissionData = await this.ministrySubmissionDataRepository.find({
      where: { submissionIndicatorId },
    });

    this.logger.debug(`🔍 transformMinistryDataToFormDataForIndicator - Found ${submissionData.length} submission data records`);

    // Get input fields for the indicator
    const inputFields = await this.inputFieldRepository.find({
      where: { sectionId: indicatorId },
    });

    // Get subsections for this indicator
    const subsections = await this.indicatorSubsectionRepository.find({
      where: { indicatorId, status: true },
    });

    // Get input fields for subsections
    const subsectionIds = subsections.map((s: any) => s.id);
    const subsectionInputFields = subsectionIds.length > 0 
      ? await this.inputFieldRepository.find({
          where: { sectionId: In(subsectionIds) },
        })
      : [];

    const allInputFields = [...inputFields, ...subsectionInputFields];

    this.logger.debug(`🔍 Found ${inputFields.length} direct input fields and ${subsectionInputFields.length} subsection input fields`);

    // Get indicator details
    const indicator = await this.indicatorDetailRepository.findOne({
      where: { id: indicatorId },
    });

    if (!indicator) {
      this.logger.warn(`⚠️ Indicator not found: ${indicatorId}`);
      return {};
    }

    const sNo = indicator.sNo;
    const category = this.getCategoryFromIndicatorCode(sNo);
    const sectionKey = `section${sNo.replace('.', '_')}`;

    const formData: Record<string, any> = {};
    formData[category] = {};
    formData[category][sectionKey] = {};

    // Create maps for input fields
    const inputFieldMap = new Map<string, InputField>();
    allInputFields.forEach(field => inputFieldMap.set(field.id, field));
    
    const directInputFieldIds = new Set(inputFields.map(f => f.id));
    const subsectionInputFieldIds = new Set(subsectionInputFields.map(f => f.id));

    // Separate direct input fields from subsection input fields
    const directInputData: MinistrySubmissionData[] = [];
    const subsectionData: MinistrySubmissionData[] = [];

    submissionData.forEach(data => {
      if (directInputFieldIds.has(data.inputFieldId)) {
        directInputData.push(data);
      } else if (subsectionInputFieldIds.has(data.inputFieldId)) {
        subsectionData.push(data);
      }
    });

    // Process direct input fields (store flat in section)
    directInputData.forEach(data => {
      const inputField = inputFieldMap.get(data.inputFieldId);
      if (!inputField) {
        this.logger.debug(`⚠️ Input field not found for data.inputFieldId: ${data.inputFieldId}`);
        return;
      }

      let value: any = null;
      if (data.valueNumber !== null) {
        value = data.valueNumber;
      } else if (data.valueText !== null) {
        value = data.valueText;
      } else if (data.valueDate !== null) {
        value = data.valueDate;
      } else if (data.valueJson !== null) {
        value = data.valueJson;
      }

      const fieldKey = this.normalizeFieldName(inputField.label || inputField.id);
      formData[category][sectionKey][fieldKey] = value;
      formData[category][sectionKey][inputField.id] = value;
      
      // Also store with original label for better matching
      formData[category][sectionKey][inputField.label] = value;
      
      this.logger.debug(`🔍 Stored direct field: label="${inputField.label}", normalized="${fieldKey}", value=${value}`);
    });

    // Process subsection data (group by sequence into array)
    if (subsectionData.length > 0) {
      // Group subsection data by sequence number
      const sequenceGroups = new Map<number | null, MinistrySubmissionData[]>();
      
      subsectionData.forEach(data => {
        const sequence = data.sequence;
        if (!sequenceGroups.has(sequence)) {
          sequenceGroups.set(sequence, []);
        }
        sequenceGroups.get(sequence)!.push(data);
      });

      // Create array of proposal objects (one per sequence)
      const proposals: any[] = [];
      
      // Sort sequences to maintain order (null sequences last)
      const sortedSequences = Array.from(sequenceGroups.keys()).sort((a, b) => {
        if (a === null) return 1;
        if (b === null) return -1;
        return a - b;
      });

      sortedSequences.forEach(sequence => {
        const sequenceData = sequenceGroups.get(sequence)!;
        const proposal: any = {};

        sequenceData.forEach(data => {
          const inputField = inputFieldMap.get(data.inputFieldId);
          if (!inputField) {
            this.logger.debug(`⚠️ Input field not found for data.inputFieldId: ${data.inputFieldId}`);
            return;
          }

          let value: any = null;
          if (data.valueNumber !== null) {
            value = data.valueNumber;
          } else if (data.valueText !== null) {
            value = data.valueText;
          } else if (data.valueDate !== null) {
            value = data.valueDate;
          } else if (data.valueJson !== null) {
            value = data.valueJson;
          }

          const fieldKey = this.normalizeFieldName(inputField.label || inputField.id);
          proposal[fieldKey] = value;
          proposal[inputField.id] = value;
          proposal[inputField.label] = value;
        });

        proposals.push(proposal);
      });

      // Store proposals array in section
      formData[category][sectionKey]['proposals'] = proposals;
      formData[category][sectionKey]['Proposals submitted under VGF/IIPDF'] = proposals;
      formData[category][sectionKey]['proposalssubmittedundervgfiipdf'] = proposals;
      
      this.logger.debug(`🔍 Created ${proposals.length} proposals from subsection data`);
    }

    this.logger.debug(`🔍 Final formData for ${sectionKey}: ${JSON.stringify(formData[category][sectionKey], null, 2)}`);

    return formData;
  }

  /**
   * Helper method to resolve submissionId to UUID format
   * Handles both UUID and submissionId string format (SUB- format)
   */
  private async resolveSubmissionIdToUUID(submissionId: string): Promise<string | null> {
    // Check if submissionId is already a UUID format
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(submissionId);
    
    if (isUUID) {
      return submissionId;
    }
    
    // It's likely a submissionId string (SUB- format), need to find the actual UUID
    this.logger.debug(`🔍 submissionId appears to be string format, resolving to UUID...`);
    const submission = await this.ministrySubmissionRepository.findOne({
      where: { submissionId: submissionId },
    });
    
    if (submission) {
      this.logger.debug(`✅ Resolved submissionId "${submissionId}" to UUID: ${submission.id}`);
      return submission.id;
    } else {
      this.logger.warn(`⚠️ Could not find submission with submissionId: ${submissionId}`);
      return null;
    }
  }

  /**
   * Get indicator score for a specific indicator
   * Handles both UUID and submissionId string format
   * For consolidated submissions, aggregates scores from all source submissions
   */
  async getIndicatorScore(
    submissionId: string,
    indicatorCode: string
  ): Promise<MinistryIndicatorScore | null> {
    this.logger.debug(`🔍 Fetching indicator score for submissionId: ${submissionId}, indicatorCode: ${indicatorCode}`);
    
    // Resolve submissionId to UUID format
    const actualSubmissionId = await this.resolveSubmissionIdToUUID(submissionId);
    if (!actualSubmissionId) {
      return null;
    }
    
    // Check if this is a consolidated submission
    const submission = await this.ministrySubmissionRepository.findOne({
      where: { id: actualSubmissionId },
    });
    
    if (!submission) {
      this.logger.debug(`⚠️ Submission not found: ${actualSubmissionId}`);
      return null;
    }
    
    // If consolidated, aggregate scores from source submissions
    if (submission.isConsolidated) {
      this.logger.debug(`📊 Consolidated submission detected, aggregating score for indicator ${indicatorCode}`);
      
      // Get formId from consolidated submission
      const formId = submission.formId;
      if (!formId) {
        this.logger.warn(`⚠️ Consolidated submission ${actualSubmissionId} does not have a formId`);
        return null;
      }
      
      // Get all source submissions (isConsolidated = false) for this formId
      const sourceSubmissions = await this.ministrySubmissionRepository.find({
        where: {
          formId: formId,
          isConsolidated: false,
        },
      });
      
      if (sourceSubmissions.length === 0) {
        this.logger.debug(`⚠️ No source submissions found for consolidated submission ${actualSubmissionId}`);
        return null;
      }
      
      const sourceSubmissionIds = sourceSubmissions.map(s => s.id);
      this.logger.debug(`📊 Found ${sourceSubmissions.length} source submissions: ${sourceSubmissionIds.join(', ')}`);
      
      // Get all scores for this indicator from source submissions
      const sourceScores = await this.ministryIndicatorScoreRepository.find({
        where: {
          submissionId: In(sourceSubmissionIds),
          indicatorCode: indicatorCode,
        },
      });
      
      if (sourceScores.length === 0) {
        this.logger.debug(`⚠️ No scores found for indicator ${indicatorCode} in source submissions`);
        return null;
      }
      
      // Aggregate ONLY system-generated scores (not manual updates)
      // Manual updates are handled separately via getLatestManualScoreUpdate
      let totalScore = 0;
      let maxScore = sourceScores[0]?.maxScore || 0;
      
      // Sum up system-generated scores from all source submissions
      sourceScores.forEach(score => {
        // Always use system-generated score, not manual updates
        totalScore += parseFloat(score.score.toString());
        this.logger.debug(`📊 Using system score for source ${score.submissionId}: ${score.score}`);
      });
      
      // Create aggregated score object
      const baseCalculation = sourceScores[0].calculation || {
        indicator: indicatorCode,
        value: 0,
        weight: 0,
        score: 0,
        maxScore: maxScore,
      };
      
      const aggregatedScore: MinistryIndicatorScore = {
        id: `${actualSubmissionId}_${indicatorCode}`, // Synthetic ID
        submissionId: actualSubmissionId,
        indicatorCode: indicatorCode,
        category: sourceScores[0].category,
        score: totalScore,
        maxScore: maxScore,
        calculation: {
          indicator: baseCalculation.indicator || indicatorCode,
          value: baseCalculation.value || 0,
          weight: baseCalculation.weight || 0,
          score: totalScore,
          maxScore: maxScore,
          aggregatedFrom: sourceScores.length,
          sourceSubmissionIds: sourceSubmissionIds,
        },
        createdAt: sourceScores[0].createdAt,
        updatedAt: new Date(), // Use current date for aggregated score
      };
      
      this.logger.debug(`✅ Aggregated score for indicator ${indicatorCode}: ${totalScore}/${maxScore} from ${sourceScores.length} source submissions`);
      
      return aggregatedScore;
    }
    
    // For non-consolidated submissions, return score as-is
    const score = await this.ministryIndicatorScoreRepository.findOne({
      where: { submissionId: actualSubmissionId, indicatorCode },
    });
    
    if (score) {
      this.logger.debug(`✅ Found score: ${score.score}/${score.maxScore} for indicator ${indicatorCode}`);
    } else {
      this.logger.debug(`⚠️ No score found for submissionId: ${actualSubmissionId}, indicatorCode: ${indicatorCode}`);
    }
    
    return score;
  }

  /**
   * Get all indicator scores for a submission
   * Handles both UUID and submissionId string format
   * For consolidated submissions, aggregates scores from all source submissions
   */
  async getSubmissionIndicatorScores(
    submissionId: string
  ): Promise<MinistryIndicatorScore[]> {
    this.logger.debug(`🔍 Fetching all indicator scores for submissionId: ${submissionId}`);
    
    // Resolve submissionId to UUID format
    const actualSubmissionId = await this.resolveSubmissionIdToUUID(submissionId);
    if (!actualSubmissionId) {
      return [];
    }
    
    // Check if this is a consolidated submission
    const submission = await this.ministrySubmissionRepository.findOne({
      where: { id: actualSubmissionId },
    });
    
    if (!submission) {
      this.logger.debug(`⚠️ Submission not found: ${actualSubmissionId}`);
      return [];
    }
    
    // If consolidated, aggregate scores from source submissions
    if (submission.isConsolidated) {
      this.logger.debug(`📊 Consolidated submission detected, aggregating scores from source submissions`);
      
      // Get formId from consolidated submission
      const formId = submission.formId;
      if (!formId) {
        this.logger.warn(`⚠️ Consolidated submission ${actualSubmissionId} does not have a formId`);
        return [];
      }
      
      // Get all source submissions (isConsolidated = false) for this formId
      const sourceSubmissions = await this.ministrySubmissionRepository.find({
        where: {
          formId: formId,
          isConsolidated: false,
        },
      });
      
      if (sourceSubmissions.length === 0) {
        this.logger.debug(`⚠️ No source submissions found for consolidated submission ${actualSubmissionId}`);
        return [];
      }
      
      const sourceSubmissionIds = sourceSubmissions.map(s => s.id);
      this.logger.debug(`📊 Found ${sourceSubmissions.length} source submissions: ${sourceSubmissionIds.join(', ')}`);
      
      // Get all scores from source submissions
      const allSourceScores = await this.ministryIndicatorScoreRepository.find({
        where: { submissionId: In(sourceSubmissionIds) },
        order: { indicatorCode: 'ASC' },
      });
      
      // Aggregate ONLY system-generated scores (not manual updates)
      // Manual updates are handled separately via getLatestManualScoreUpdate
      const aggregatedScoresMap = new Map<string, MinistryIndicatorScore[]>();
      
      allSourceScores.forEach(score => {
        if (!aggregatedScoresMap.has(score.indicatorCode)) {
          aggregatedScoresMap.set(score.indicatorCode, []);
        }
        aggregatedScoresMap.get(score.indicatorCode)!.push(score);
      });
      
      // Create aggregated scores
      const aggregatedScores: MinistryIndicatorScore[] = [];
      
      aggregatedScoresMap.forEach((scores, indicatorCode) => {
        // Sum up ONLY system-generated scores
        let totalScore = 0;
        let maxScore = scores[0]?.maxScore || 0;
        
        scores.forEach(score => {
          // Always use system-generated score, not manual updates
          totalScore += parseFloat(score.score.toString());
        });
        
        // Create aggregated score object
        const baseCalculation = scores[0].calculation || {
          indicator: indicatorCode,
          value: 0,
          weight: 0,
          score: 0,
          maxScore: maxScore,
        };
        
        const aggregatedScore: MinistryIndicatorScore = {
          id: `${actualSubmissionId}_${indicatorCode}`, // Synthetic ID
          submissionId: actualSubmissionId,
          indicatorCode: indicatorCode,
          category: scores[0].category,
          score: totalScore,
          maxScore: maxScore,
          calculation: {
            indicator: baseCalculation.indicator || indicatorCode,
            value: baseCalculation.value || 0,
            weight: baseCalculation.weight || 0,
            score: totalScore,
            maxScore: maxScore,
            aggregatedFrom: scores.length,
            sourceSubmissionIds: sourceSubmissionIds,
          },
          createdAt: scores[0].createdAt,
          updatedAt: new Date(), // Use current date for aggregated score
        };
        
        aggregatedScores.push(aggregatedScore);
      });
      
      // Sort by indicator code
      aggregatedScores.sort((a, b) => a.indicatorCode.localeCompare(b.indicatorCode));
      
      this.logger.debug(`✅ Aggregated ${aggregatedScores.length} indicator scores from ${sourceSubmissions.length} source submissions`);
      
      return aggregatedScores;
    }
    
    // For non-consolidated submissions, return scores as-is
    const scores = await this.ministryIndicatorScoreRepository.find({
      where: { submissionId: actualSubmissionId },
      order: { indicatorCode: 'ASC' },
    });
    
    this.logger.debug(`✅ Found ${scores.length} indicator scores for submissionId: ${actualSubmissionId}`);
    
    return scores;
  }

  /**
   * Get score history for a specific indicator
   * Handles both UUID and submissionId string format
   */
  async getIndicatorScoreHistory(
    submissionId: string,
    indicatorCode: string
  ): Promise<MinistryIndicatorScoreHistory[]> {
    // Resolve submissionId to UUID format
    const actualSubmissionId = await this.resolveSubmissionIdToUUID(submissionId);
    if (!actualSubmissionId) {
      return [];
    }
    
    return await this.ministryIndicatorScoreHistoryRepository.find({
      where: { submissionId: actualSubmissionId, indicatorCode },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get latest manual score update for a specific indicator
   * Handles both UUID and submissionId string format
   * For consolidated submissions, returns the most recent manual update from source submissions
   */
  async getLatestManualScoreUpdate(
    submissionId: string,
    indicatorCode: string
  ): Promise<MinistryManualScoreUpdate | null> {
    // Resolve submissionId to UUID format
    const actualSubmissionId = await this.resolveSubmissionIdToUUID(submissionId);
    if (!actualSubmissionId) {
      return null;
    }
    
    // Check if this is a consolidated submission
    const submission = await this.ministrySubmissionRepository.findOne({
      where: { id: actualSubmissionId },
    });
    
    if (!submission) {
      return null;
    }
    
    // If consolidated, get latest manual update from source submissions
    if (submission.isConsolidated) {
      this.logger.debug(`📊 Consolidated submission detected, fetching latest manual update from source submissions`);
      
      // Get formId from consolidated submission
      const formId = submission.formId;
      if (!formId) {
        return null;
      }
      
      // Get all source submissions (isConsolidated = false) for this formId
      const sourceSubmissions = await this.ministrySubmissionRepository.find({
        where: {
          formId: formId,
          isConsolidated: false,
        },
      });
      
      if (sourceSubmissions.length === 0) {
        return null;
      }
      
      const sourceSubmissionIds = sourceSubmissions.map(s => s.id);
      
      // Get all manual updates for this indicator from source submissions
      const manualUpdates = await this.ministryManualScoreUpdateRepository.find({
        where: {
          submissionId: In(sourceSubmissionIds),
          indicatorCode: indicatorCode,
        },
        order: { createdAt: 'DESC' },
      });
      
      if (manualUpdates.length === 0) {
        return null;
      }
      
      // Return the most recent one
      return manualUpdates[0];
    }
    
    // For non-consolidated submissions, return as-is
    return await this.ministryManualScoreUpdateRepository.findOne({
      where: { submissionId: actualSubmissionId, indicatorCode },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Save manual score update for a ministry indicator
   * Handles both UUID and submissionId string format
   * For consolidated submissions, saves to all source submissions that have this indicator
   */
  async saveManualScoreUpdate(
    submissionId: string,
    indicatorCode: string,
    category: string,
    updatedScore: number,
    maxScore: number,
    updateReason: string,
    userId: string
  ): Promise<MinistryManualScoreUpdate> {
    this.logger.log(
      `💾 Saving manual score update for ministry indicator ${indicatorCode} in submission ${submissionId}`
    );

    // Validate that updated score does not exceed maximum score
    if (updatedScore > maxScore) {
      throw new Error(
        `Updated score (${updatedScore}) cannot exceed maximum score (${maxScore}) for indicator ${indicatorCode}`
      );
    }

    // Validate that updated score is not negative
    if (updatedScore < 0) {
      throw new Error(`Updated score cannot be negative`);
    }

    // Resolve submissionId to UUID format if needed
    const actualSubmissionId = await this.resolveSubmissionIdToUUID(submissionId);
    if (!actualSubmissionId) {
      throw new Error(`Submission not found: ${submissionId}`);
    }

    // Check if this is a consolidated submission
    const submission = await this.ministrySubmissionRepository.findOne({
      where: { id: actualSubmissionId },
    });

    if (!submission) {
      throw new Error(`Submission not found: ${actualSubmissionId}`);
    }

    // If consolidated, save to all source submissions that have this indicator
    if (submission.isConsolidated) {
      this.logger.debug(`📊 Consolidated submission detected, saving manual update to source submissions`);
      
      // Get formId from consolidated submission
      const formId = submission.formId;
      if (!formId) {
        throw new Error(`Consolidated submission ${actualSubmissionId} does not have a formId`);
      }

      // Get all source submissions (isConsolidated = false) for this formId
      const sourceSubmissions = await this.ministrySubmissionRepository.find({
        where: {
          formId: formId,
          isConsolidated: false,
        },
      });

      if (sourceSubmissions.length === 0) {
        throw new Error(`No source submissions found for consolidated submission ${actualSubmissionId}`);
      }

      const sourceSubmissionIds = sourceSubmissions.map(s => s.id);
      this.logger.debug(`📊 Found ${sourceSubmissions.length} source submissions: ${sourceSubmissionIds.join(', ')}`);

      // Find the indicator by sNo (which contains the indicator code like "1.1", "2.3", etc.)
      const indicator = await this.indicatorDetailRepository.findOne({
        where: { sNo: indicatorCode },
      });

      if (!indicator) {
        throw new Error(`Indicator with code ${indicatorCode} not found`);
      }

      // Find all source submissions that have this indicator
      const submissionIndicators = await this.ministrySubmissionIndicatorRepository.find({
        where: {
          submissionId: In(sourceSubmissionIds),
          indicatorId: indicator.id,
        },
      });

      if (submissionIndicators.length === 0) {
        throw new Error(`No source submissions found with indicator ${indicatorCode}`);
      }

      const sourceSubmissionsWithIndicator = submissionIndicators.map(si => si.submissionId);
      const uniqueSourceSubmissionIds = [...new Set(sourceSubmissionsWithIndicator)];
      
      this.logger.debug(`📊 Found ${uniqueSourceSubmissionIds.length} source submissions with indicator ${indicatorCode}`);

      // Get aggregated system score for reference
      const aggregatedSystemScore = await this.getIndicatorScore(actualSubmissionId, indicatorCode);
      const aggregatedSystemScoreValue = aggregatedSystemScore ? parseFloat(aggregatedSystemScore.score.toString()) : 0;

      // Calculate per-source score: divide updated score by number of sources
      // This ensures that when aggregated, the total equals the updated score
      // Example: If user sets 10 for consolidated with 3 sources, save 10/3 = 3.33 to each
      // When aggregated: 3.33 + 3.33 + 3.33 = 10
      const perSourceScore = uniqueSourceSubmissionIds.length > 0 
        ? updatedScore / uniqueSourceSubmissionIds.length 
        : updatedScore;

      this.logger.debug(`📊 Distributing updated score ${updatedScore} across ${uniqueSourceSubmissionIds.length} sources: ${perSourceScore.toFixed(2)} per source`);

      // Save manual update to each source submission
      const savedUpdates: MinistryManualScoreUpdate[] = [];
      
      for (const sourceSubmissionId of uniqueSourceSubmissionIds) {
        // Get the system score for this specific source submission
        const sourceScore = await this.ministryIndicatorScoreRepository.findOne({
          where: { submissionId: sourceSubmissionId, indicatorCode },
        });
        const sourceSystemScore = sourceScore ? parseFloat(sourceScore.score.toString()) : 0;

        // Create manual update record for this source submission
        // Save the per-source score so that when aggregated, it equals the user's updated score
        const manualUpdate = this.ministryManualScoreUpdateRepository.create({
          submissionId: sourceSubmissionId, // Save to source submission, not consolidated
          indicatorCode,
          category,
          systemScore: sourceSystemScore,
          manualUpdatedScore: perSourceScore, // Per-source score that will aggregate to updatedScore
          maxScore: maxScore,
          updateReason: updateReason, // Save only the user's input reason
          updatedBy: userId,
        });

        const savedUpdate = await this.ministryManualScoreUpdateRepository.save(manualUpdate);
        savedUpdates.push(savedUpdate);

        this.logger.debug(
          `✅ Saved manual score update to source submission ${sourceSubmissionId}: ` +
          `System Score: ${sourceSystemScore} → Manual Updated Score: ${perSourceScore.toFixed(2)} ` +
          `(Part of consolidated total: ${updatedScore})`
        );
      }

      this.logger.log(
        `✅ Saved manual score update for consolidated submission ${actualSubmissionId}, indicator ${indicatorCode}: ` +
        `Aggregated System Score: ${aggregatedSystemScoreValue} → Aggregated Manual Updated Score: ${updatedScore} ` +
        `(Saved to ${savedUpdates.length} source submissions) at ${savedUpdates[0].createdAt}`
      );

      // Return a synthetic update object representing the consolidated update
      // This allows the frontend to see the aggregated value
      return {
        ...savedUpdates[0],
        submissionId: actualSubmissionId, // Return consolidated submission ID for consistency
        manualUpdatedScore: updatedScore, // Return the aggregated value
        systemScore: aggregatedSystemScoreValue, // Return the aggregated system score
      } as MinistryManualScoreUpdate;
    }

    // For non-consolidated submissions, save as before
    // Get the current system-generated score (this is NOT modified)
    const currentScore = await this.getIndicatorScore(actualSubmissionId, indicatorCode);
    const systemScore = currentScore ? parseFloat(currentScore.score.toString()) : 0;

    // Create manual update record
    const manualUpdate = this.ministryManualScoreUpdateRepository.create({
      submissionId: actualSubmissionId,
      indicatorCode,
      category,
      systemScore,
      manualUpdatedScore: updatedScore,
      maxScore,
      updateReason,
      updatedBy: userId,
    });

    const savedUpdate = await this.ministryManualScoreUpdateRepository.save(manualUpdate);

    this.logger.log(
      `✅ Saved manual score update for ministry indicator ${indicatorCode}: ` +
      `System Score: ${systemScore} → Manual Updated Score: ${updatedScore} ` +
      `(Reason: ${updateReason}) at ${savedUpdate.createdAt}`
    );

    return savedUpdate;
  }

  /**
   * Get manual score update history for a ministry indicator
   * Handles both UUID and submissionId string format
   * For consolidated submissions, returns history from all source submissions
   */
  async getManualScoreUpdateHistory(
    submissionId: string,
    indicatorCode: string
  ): Promise<MinistryManualScoreUpdate[]> {
    // Resolve submissionId to UUID format
    const actualSubmissionId = await this.resolveSubmissionIdToUUID(submissionId);
    if (!actualSubmissionId) {
      return [];
    }
    
    // Check if this is a consolidated submission
    const submission = await this.ministrySubmissionRepository.findOne({
      where: { id: actualSubmissionId },
    });
    
    if (!submission) {
      return [];
    }
    
    // If consolidated, get history from all source submissions
    if (submission.isConsolidated) {
      this.logger.debug(`📊 Consolidated submission detected, fetching manual update history from source submissions`);
      
      // Get formId from consolidated submission
      const formId = submission.formId;
      if (!formId) {
        return [];
      }
      
      // Get all source submissions (isConsolidated = false) for this formId
      const sourceSubmissions = await this.ministrySubmissionRepository.find({
        where: {
          formId: formId,
          isConsolidated: false,
        },
      });
      
      if (sourceSubmissions.length === 0) {
        return [];
      }
      
      const sourceSubmissionIds = sourceSubmissions.map(s => s.id);
      
      // Get all manual updates for this indicator from source submissions
      const manualUpdates = await this.ministryManualScoreUpdateRepository.find({
        where: {
          submissionId: In(sourceSubmissionIds),
          indicatorCode: indicatorCode,
        },
        order: { createdAt: 'DESC' },
      });
      
      return manualUpdates;
    }
    
    // For non-consolidated submissions, return as-is
    return await this.ministryManualScoreUpdateRepository.find({
      where: { submissionId: actualSubmissionId, indicatorCode },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Calculate and save final score for a ministry submission
   * Uses manual updated scores if available (only the latest one per indicator), otherwise uses system-generated scores
   * For consolidated submissions, aggregates scores from all source submissions
   */
  async calculateFinalScore(
    submissionId: string,
    userId: string
  ): Promise<MinistryScoreBreakdown> {
    this.logger.log(`🧮 Calculating final score for ministry submission ${submissionId}`);

    // Resolve submissionId to UUID format
    const actualSubmissionId = await this.resolveSubmissionIdToUUID(submissionId);
    if (!actualSubmissionId) {
      throw new NotFoundException(`Submission not found: ${submissionId}`);
    }

    const submission = await this.ministrySubmissionRepository.findOne({
      where: { id: actualSubmissionId },
    });

    if (!submission) {
      throw new NotFoundException(`Submission not found: ${actualSubmissionId}`);
    }

    // Get ministryId from the form
    let ministryId = '';
    if (submission.formId) {
      const formRepository = this.dataSource.getRepository(Form);
      const form = await formRepository.findOne({
        where: { id: submission.formId },
      });
      if (form && form.ministry) {
        ministryId = form.ministry;
      }
    }

    // Get all indicator scores for this submission
    // For consolidated submissions, getSubmissionIndicatorScores already aggregates
    const indicatorScores = await this.getSubmissionIndicatorScores(actualSubmissionId);

    if (indicatorScores.length === 0) {
      throw new NotFoundException(`No indicator scores found for submission ${actualSubmissionId}`);
    }

    // Calculate final score using manual scores if available, otherwise system scores
    const scoreBreakdown = await this.sumMinistryIndicatorScores(
      actualSubmissionId,
      ministryId,
      userId,
      indicatorScores
    );

    return scoreBreakdown;
  }

  /**
   * Sum all indicator scores for final score calculation
   * Uses manual updated scores if available (only the latest one per indicator), otherwise uses system-generated scores
   */
  private async sumMinistryIndicatorScores(
    submissionId: string,
    ministryId: string,
    userId: string,
    indicatorScores: MinistryIndicatorScore[]
  ): Promise<MinistryScoreBreakdown> {
    this.logger.log(`🔍 Summing indicator scores for ministry submission ${submissionId}...`);

    // Check if this is a consolidated submission
    const submission = await this.ministrySubmissionRepository.findOne({
      where: { id: submissionId },
    });

    let manualScoreUpdates: MinistryManualScoreUpdate[] = [];

    if (submission?.isConsolidated) {
      // For consolidated submissions, get manual updates from all source submissions
      const formId = submission.formId;
      if (formId) {
        const sourceSubmissions = await this.ministrySubmissionRepository.find({
          where: {
            formId: formId,
            isConsolidated: false,
          },
        });
        const sourceSubmissionIds = sourceSubmissions.map(s => s.id);

        // Get all manual updates from source submissions
        manualScoreUpdates = await this.ministryManualScoreUpdateRepository.find({
          where: { submissionId: In(sourceSubmissionIds) },
          order: { createdAt: 'DESC' },
        });
      }
    } else {
      // For non-consolidated submissions, get manual updates for this submission
      manualScoreUpdates = await this.ministryManualScoreUpdateRepository.find({
        where: { submissionId },
        order: { createdAt: 'DESC' },
      });
    }

    // Create a map of indicatorCode -> LATEST manual updated score only
    // Since we ordered by createdAt DESC, the first occurrence of each indicatorCode is the latest
    const latestManualScoreMap = new Map<string, MinistryManualScoreUpdate>();
    manualScoreUpdates.forEach(update => {
      // Only add if we haven't seen this indicatorCode yet (ensures we only keep the latest)
      if (!latestManualScoreMap.has(update.indicatorCode)) {
        latestManualScoreMap.set(update.indicatorCode, update);
        this.logger.log(
          `📝 Using latest manual updated score for indicator ${update.indicatorCode}: ${update.manualUpdatedScore} (updated at ${update.createdAt})`
        );
      }
    });

    this.logger.log(
      `📊 Found ${latestManualScoreMap.size} indicators with manual score updates (latest only) out of ${indicatorScores.length} total indicators`
    );

    const calculations: MinistryScoreCalculation[] = [];

    // Group by category
    const categoryScores = {
      infraFinancing: { score: 0, maxScore: 250 },
      infraDevelopment: { score: 0, maxScore: 250 },
      pppDevelopment: { score: 0, maxScore: 250 },
      infraEnablers: { score: 0, maxScore: 250 },
    };

    let totalScore = 0;
    let maxPossibleScore = 1000; // Total is always 1000 (250+250+250+250)
    let manualScoresUsed = 0;
    let systemScoresUsed = 0;

    indicatorScores.forEach(is => {
      // Check if latest manual updated score exists for this indicator
      const latestManualUpdate = latestManualScoreMap.get(is.indicatorCode);

      let scoreToUse: number;
      let maxScoreToUse: number;
      let scoreSource: 'system' | 'manual';

      if (latestManualUpdate) {
        // Use the LATEST manual updated score for this indicator
        scoreToUse = parseFloat(latestManualUpdate.manualUpdatedScore.toString());
        maxScoreToUse = parseFloat(latestManualUpdate.maxScore.toString());
        scoreSource = 'manual';
        manualScoresUsed++;
        this.logger.log(
          `✅ Using LATEST manual updated score for indicator ${is.indicatorCode}: ${scoreToUse} (system score was ${is.score})`
        );
      } else {
        // Use system-generated score (no manual update exists for this indicator)
        scoreToUse = parseFloat(is.score.toString());
        maxScoreToUse = parseFloat(is.maxScore.toString());
        scoreSource = 'system';
        systemScoresUsed++;
      }

      totalScore += scoreToUse;

      // Add to category totals
      if (categoryScores[is.category]) {
        categoryScores[is.category].score += scoreToUse;
      }

      // Update calculation object to reflect the score used
      const calculation: MinistryScoreCalculation = {
        indicator: is.indicatorCode,
        value: is.calculation?.value || 0,
        weight: is.calculation?.weight || 0,
        score: scoreToUse,
        maxScore: maxScoreToUse,
        source: scoreSource,
      };
      calculations.push(calculation);
    });

    const percentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;

    const scoreBreakdown: MinistryScoreBreakdown = {
      totalScore: Math.round(totalScore * 100) / 100,
      maxPossibleScore,
      percentage: Math.round(percentage * 100) / 100,
      calculations,
      categoryScores: {
        infraFinancing: {
          score: Math.round(categoryScores.infraFinancing.score * 100) / 100,
          maxScore: 250,
          percentage: Math.round((categoryScores.infraFinancing.score / 250) * 100 * 100) / 100,
        },
        infraDevelopment: {
          score: Math.round(categoryScores.infraDevelopment.score * 100) / 100,
          maxScore: 250,
          percentage: Math.round((categoryScores.infraDevelopment.score / 250) * 100 * 100) / 100,
        },
        pppDevelopment: {
          score: Math.round(categoryScores.pppDevelopment.score * 100) / 100,
          maxScore: 250,
          percentage: Math.round((categoryScores.pppDevelopment.score / 250) * 100 * 100) / 100,
        },
        infraEnablers: {
          score: Math.round(categoryScores.infraEnablers.score * 100) / 100,
          maxScore: 250,
          percentage: Math.round((categoryScores.infraEnablers.score / 250) * 100 * 100) / 100,
        }
      },
      methodology: 'NIRI Ministry Scoring Methodology v1.0 - Sum of individual indicator scores (using latest manual updated scores where available)',
    };

    // Check if final score already exists
    const existingFinalScore = await this.ministryFinalScoreRepository.findOne({
      where: { submissionId },
    });

    if (existingFinalScore) {
      // Update existing final score
      existingFinalScore.totalScore = scoreBreakdown.totalScore;
      existingFinalScore.percentage = scoreBreakdown.percentage;
      existingFinalScore.scoreBreakdown = scoreBreakdown;
      existingFinalScore.categoryScores = scoreBreakdown.categoryScores;
      existingFinalScore.calculationMethodology = scoreBreakdown.methodology;
      existingFinalScore.approvedBy = userId;
      await this.ministryFinalScoreRepository.save(existingFinalScore);
      this.logger.log(
        `✅ Updated final score: ${scoreBreakdown.totalScore} points (${scoreBreakdown.percentage}%) - Used ${manualScoresUsed} latest manual updated scores, ${systemScoresUsed} system scores`
      );
    } else {
      // Create new final score
      const finalScore = this.ministryFinalScoreRepository.create({
        submissionId,
        ministryId,
        totalScore: scoreBreakdown.totalScore,
        percentage: scoreBreakdown.percentage,
        scoreBreakdown,
        categoryScores: scoreBreakdown.categoryScores,
        calculationMethodology: scoreBreakdown.methodology,
        approvedBy: userId,
      });

      await this.ministryFinalScoreRepository.save(finalScore);
      this.logger.log(
        `✅ Final score saved: ${scoreBreakdown.totalScore} points (${scoreBreakdown.percentage}%) - Used ${manualScoresUsed} latest manual updated scores, ${systemScoresUsed} system scores`
      );
    }

    return scoreBreakdown;
  }
}

