import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { MinistrySubmission } from '../../ministry/entities/ministry-submission.entity';
import { MinistrySubmissionIndicator } from '../../ministry/entities/ministry-submission-indicator.entity';
import { MinistrySubmissionData } from '../../ministry/entities/ministry-submission-data.entity';
import { IndicatorDetail } from '../../ministry/entities/indicator-detail.entity';
import { InputField } from '../../ministry/entities/input-field.entity';

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

  constructor(
    @InjectRepository(MinistrySubmission)
    private ministrySubmissionRepository: Repository<MinistrySubmission>,
    @InjectRepository(MinistrySubmissionIndicator)
    private ministrySubmissionIndicatorRepository: Repository<MinistrySubmissionIndicator>,
    @InjectRepository(MinistrySubmissionData)
    private ministrySubmissionDataRepository: Repository<MinistrySubmissionData>,
    @InjectRepository(IndicatorDetail)
    private indicatorDetailRepository: Repository<IndicatorDetail>,
    @InjectRepository(InputField)
    private inputFieldRepository: Repository<InputField>,
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
        const fieldKey = this.normalizeFieldName(inputField.label || inputField.name || inputField.id);
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

    switch (indicatorCode) {
      case '1.1': {
        // % Capex Utilization = (Actuals ÷ Total Budgeted Capex) × 100
        // Score = 1 mark for every 1%, Max 100
        const actuals = this.getNumericValue(section, ['actualcapex', 'actualcapexutilization', 'actuals', 'actualcapitalexpenditure']);
        const totalBudgetedCapex = this.getNumericValue(section, ['totalbudgetedcapex', 'budgetedcapex', 'totalcapex', 'budgetedcapitalallocation']);
        
        const capexUtilization = totalBudgetedCapex > 0 ? (actuals / totalBudgetedCapex) * 100 : 0;
        const score = Math.min(capexUtilization * 1, 100); // 1 mark per 1%

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
        const actualUtilization = this.getNumericValue(section, ['actualutilization', 'actualmonetization', 'actualvalue']);
        const estimatedMonetizationValue = this.getNumericValue(section, ['estimatedmonetizationvalue', 'estimatedvalue', 'monetizationvalue']);
        
        const A1 = estimatedMonetizationValue > 0 ? (actualUtilization / estimatedMonetizationValue) * 100 : 0;
        const A2 = A1 / 2;
        const score = Math.min(A2 * 1.5, 75); // 1.5 marks per 2%

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
        const hasSpecialFinancing = this.getBooleanValue(section, ['hasspecialfinancing', 'specialfinancing', 'hasfinancingmechanism', 'financingmechanism']);
        
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
        const hasInfraPlan = this.getBooleanValue(section, ['hasinfraplan', 'hasinfrastructureplan', 'infrastructureplan', 'hasplan']);
        
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
        const hasInvestmentReady = this.getBooleanValue(section, ['hasinvestmentready', 'investmentready', 'hasinvestmentreadyprojects', 'investmentreadyprojects']);
        
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
        const hasProgramBasedApproach = this.getBooleanValue(section, ['hasprogrambasedapproach', 'programbasedapproach', 'hasprogramapproach', 'programapproach']);
        
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
        const hasMCA = this.getBooleanValue(section, ['hasmca', 'hasmodelconcessionagreement', 'modelconcessionagreement', 'mca']);
        
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
        const pppProjectsValue = this.getNumericValue(section, ['pppprojectsvalue', 'pppprojectcost', 'ppptotalprojectcost', 'ppptpc']);
        const totalProjectsValue = this.getNumericValue(section, ['totalprojectsvalue', 'totalprojectcost', 'totalnipvalue', 'totalvalue']);
        
        const percentage = totalProjectsValue > 0 ? (pppProjectsValue / totalProjectsValue) * 100 : 0;
        const score = Math.min(percentage * 1, 50); // 1 mark per 1%

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
        const hasPolicyDirectives = this.getBooleanValue(section, ['haspolicydirectives', 'policydirectives', 'hasppppolicy', 'ppppolicy']);
        
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
        const proposalsArray = this.getArrayValue(section, ['proposals', 'vgfproposals', 'iipdfproposals', 'vgfiipdfproposals']);
        
        const validProposals = proposalsArray.filter(item => {
          if (!item) return false;
          // Check if proposal has required fields
          return this.hasValidProposal(item);
        }).length;
        
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
        const totalTPC = this.getNumericValue(section, ['totaltpc', 'totalppptpc', 'totalprojectcost', 'sumoftpc']);
        const totalBudgetedCapital = this.getNumericValue(section, ['totalbudgetedcapital', 'budgetedcapitalallocation', 'totalcapitalallocation', 'budgetedcapital']);
        
        const proportion = totalBudgetedCapital > 0 ? (totalTPC / totalBudgetedCapital) * 100 : 0;
        const score = Math.min(proportion * 2, 100); // 2 marks per 1%

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
        const hasMonitoringSystem = this.getBooleanValue(section, ['hasmonitoringsystem', 'hasprojectmonitoringsystem', 'monitoringsystem', 'projectmonitoring']);
        
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
        const projectsArray = this.getArrayValue(section, ['projects', 'gatishaktiprojects', 'pmgatishaktiprojects', 'plannedprojects']);
        
        const validProjects = projectsArray.filter(item => {
          if (!item) return false;
          // Check if project is planned through PM GatiShakti
          return this.hasValidGatiShaktiProject(item);
        }).length;
        
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
        const hasAdoptedADR = this.getBooleanValue(section, ['hasadoptedadr', 'adoptedadr', 'hasadr', 'adr']);
        
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
        const practicesArray = this.getArrayValue(section, ['practices', 'innovativepractices', 'practicelist']);
        
        const validPractices = practicesArray.filter(item => {
          if (!item) return false;
          // Check if practice has required fields
          return this.hasValidPractice(item);
        }).length;
        
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
        const trainingsArray = this.getArrayValue(section, ['trainings', 'officertrainings', 'trainingparticipations', 'participations']);
        
        const validTrainings = trainingsArray.filter(item => {
          if (!item) return false;
          // Check if training has required fields
          return this.hasValidTraining(item);
        }).length;
        
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
    if (!section || typeof section !== 'object') return null;
    
    // Try normalized keys first
    for (const key of possibleKeys) {
      const normalizedKey = this.normalizeFieldName(key);
      if (section[normalizedKey] !== undefined && section[normalizedKey] !== null) {
        return section[normalizedKey];
      }
      // Try original key
      if (section[key] !== undefined && section[key] !== null) {
        return section[key];
      }
    }
    
    // Try all keys in section
    const sectionKeys = Object.keys(section);
    for (const sectionKey of sectionKeys) {
      const normalizedSectionKey = this.normalizeFieldName(sectionKey);
      for (const key of possibleKeys) {
        const normalizedKey = this.normalizeFieldName(key);
        if (normalizedSectionKey === normalizedKey) {
          return section[sectionKey];
        }
      }
    }
    
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
    // Check if practice has required fields
    return item && (
      item.practiceName || 
      item.description || 
      item.file || 
      item.valueJson ||
      (typeof item === 'object' && Object.keys(item).length > 0)
    );
  }

  private hasValidTraining(item: any): boolean {
    // Check if training has required fields
    return item && (
      item.officerName || 
      item.trainingName || 
      item.participationDate ||
      item.officer ||
      item.training ||
      (typeof item === 'object' && Object.keys(item).length > 0)
    );
  }
}

