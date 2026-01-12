import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Submission, SubmissionStatus } from '../../entities/submission.entity';
import { FinalScore } from '../../entities/final-score.entity';
import { IndicatorScore } from '../../entities/indicator-score.entity';
import { IndicatorScoreHistory } from '../../entities/indicator-score-history.entity';
import { ManualScoreUpdate } from '../../entities/manual-score-update.entity';
import { UserRole } from '../../entities/user.entity';

export interface ScoreCalculation {
  indicator: string;
  value: number;
  weight: number;
  score: number;
  maxScore: number;
  source?: 'system' | 'manual'; // Optional field to track score source
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
    @InjectRepository(IndicatorScore)
    private indicatorScoreRepository: Repository<IndicatorScore>,
    @InjectRepository(IndicatorScoreHistory)
    private indicatorScoreHistoryRepository: Repository<IndicatorScoreHistory>,
    @InjectRepository(ManualScoreUpdate)
    private manualScoreUpdateRepository: Repository<ManualScoreUpdate>,
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

    // Step 2.5: Check if we have per-indicator scores (new approach)
    const indicatorScores = await this.indicatorScoreRepository.find({
      where: { submissionId },
    });

    if (indicatorScores.length > 0) {
      this.logger.log(`Found ${indicatorScores.length} indicator scores, summing them up...`);
      return await this.sumIndicatorScores(submissionId, submission.stateUt, userId, indicatorScores);
    }

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

  /**
   * Sum existing indicator scores instead of recalculating
   * Uses manual updated scores if available (only the latest one per indicator), otherwise uses system-generated scores
   */
  private async sumIndicatorScores(
    submissionId: string,
    stateUt: string,
    userId: string,
    indicatorScores: IndicatorScore[]
  ): Promise<ScoreBreakdown> {
    this.logger.log(`🔍 Summing indicator scores for submission ${submissionId}...`);
    
    // Fetch all manual score updates for this submission, ordered by creation date (newest first)
    const manualScoreUpdates = await this.manualScoreUpdateRepository.find({
      where: { submissionId },
      order: { createdAt: 'DESC' },
    });

    // Create a map of indicatorCode -> LATEST manual updated score only
    // Since we ordered by createdAt DESC, the first occurrence of each indicatorCode is the latest
    const latestManualScoreMap = new Map<string, ManualScoreUpdate>();
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

    const calculations: ScoreCalculation[] = [];
    
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
      const calculation: ScoreCalculation = {
        ...is.calculation,
        score: scoreToUse,
        maxScore: maxScoreToUse,
        // Add metadata to indicate source
        source: scoreSource,
      };
      calculations.push(calculation);
    });

    const percentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;

    const scoreBreakdown: ScoreBreakdown = {
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
      methodology: 'NIRI Scoring Methodology v2.0 - Sum of individual indicator scores (using latest manual updated scores where available)',
    };

    // Save to final_scores table
    const finalScore = this.finalScoreRepository.create({
      submissionId,
      stateUt,
      totalScore: scoreBreakdown.totalScore,
      percentage: scoreBreakdown.percentage,
      scoreBreakdown,
      categoryScores: scoreBreakdown.categoryScores,
      calculationMethodology: scoreBreakdown.methodology,
      approvedBy: userId,
    });

    await this.finalScoreRepository.save(finalScore);
    this.logger.log(
      `✅ Final score saved: ${scoreBreakdown.totalScore} points (${scoreBreakdown.percentage}%) - Used ${manualScoresUsed} latest manual updated scores, ${systemScoresUsed} system scores`
    );

    return scoreBreakdown;
  }

  /**
   * Calculate score for a single indicator and save it
   */
  async calculateIndicatorScore(
    submissionId: string,
    indicatorCode: string,
    category: string,
    formData: Record<string, any>,
    userId?: string,
    updateReason?: string,
    indicatorStatus?: string
  ): Promise<IndicatorScore> {
    this.logger.log(`🧮 Calculating score for indicator ${indicatorCode} in category ${category} for submission ${submissionId}`);
    
    // Check if score already exists - use explicit query with logging
    this.logger.log(`🔍 Checking for existing score: submissionId=${submissionId}, indicatorCode=${indicatorCode}`);
    const existingScore = await this.indicatorScoreRepository.findOne({
      where: { submissionId, indicatorCode },
    });

    if (existingScore) {
      this.logger.log(`📊 Found existing score: id=${existingScore.id}, current score=${existingScore.score}, updatedAt=${existingScore.updatedAt}`);
    } else {
      this.logger.log(`📝 No existing score found - will create new record`);
    }

    // Store previous score for history
    const previousScore = existingScore ? parseFloat(existingScore.score.toString()) : null;

    // Calculate NEW score based on CURRENT formData values
    const calculation = this.calculateSingleIndicatorScore(indicatorCode, category, formData);
    const newScore = calculation.score;

    // Calculate score change
    const scoreChange = previousScore !== null ? newScore - previousScore : null;

    this.logger.log(`📈 Score calculation: previous=${previousScore}, new=${newScore}, change=${scoreChange}`);

    const scoreData = {
      submissionId,
      indicatorCode,
      category,
      score: newScore,
      maxScore: calculation.maxScore,
      calculation,
    };

    let savedScore: IndicatorScore;

    if (existingScore) {
      // UPDATE existing score with new values
      this.logger.log(`🔄 Updating existing score record (id: ${existingScore.id})...`);
      
      // Store old values for comparison
      const oldScore = existingScore.score;
      const oldMaxScore = existingScore.maxScore;
      const oldUpdatedAt = existingScore.updatedAt;
      
      // Explicitly update each field to ensure TypeORM detects changes
      existingScore.score = newScore;
      existingScore.maxScore = calculation.maxScore;
      existingScore.category = category;
      existingScore.calculation = calculation;
      // Note: updatedAt will be automatically updated by @UpdateDateColumn when we save
      
      // Save the updated entity - this will trigger @UpdateDateColumn
      try {
        savedScore = await this.indicatorScoreRepository.save(existingScore);
      } catch (saveError) {
        this.logger.error(`❌ Error saving updated score: ${saveError.message}`);
        this.logger.error(`   Stack: ${saveError.stack}`);
        
        // Fallback: Try using update query directly
        this.logger.log(`🔄 Attempting fallback update using repository.update()...`);
        await this.indicatorScoreRepository.update(
          { id: existingScore.id },
          {
            score: newScore,
            maxScore: calculation.maxScore,
            category: category,
            calculation: calculation,
          }
        );
        
        // Fetch the updated record
        savedScore = await this.indicatorScoreRepository.findOne({
          where: { id: existingScore.id },
        });
        
        if (!savedScore) {
          throw new Error(`Failed to update score record - could not retrieve after update`);
        }
        
        this.logger.log(`✅ Fallback update successful`);
      }
      
      // Verify the update by querying the database directly
      const verifyScore = await this.indicatorScoreRepository.findOne({
        where: { id: existingScore.id },
      });
      
      if (verifyScore) {
        const scoreUpdated = parseFloat(verifyScore.score.toString()) !== parseFloat(oldScore.toString());
        const maxScoreUpdated = parseFloat(verifyScore.maxScore.toString()) !== parseFloat(oldMaxScore.toString());
        const timestampUpdated = verifyScore.updatedAt.getTime() !== oldUpdatedAt.getTime();
        
        this.logger.log(
          `✅ Successfully updated score for indicator ${indicatorCode}: ${previousScore} → ${newScore} (change: ${scoreChange})`
        );
        this.logger.log(`📋 Verification: score=${verifyScore.score}, maxScore=${verifyScore.maxScore}, updatedAt=${verifyScore.updatedAt}`);
        this.logger.log(`📊 Update status: scoreChanged=${scoreUpdated}, maxScoreChanged=${maxScoreUpdated}, timestampChanged=${timestampUpdated}`);
        
        if (!scoreUpdated || !timestampUpdated) {
          this.logger.warn(`⚠️ WARNING: Score or timestamp may not have updated properly!`);
          this.logger.warn(`   Old: score=${oldScore}, updatedAt=${oldUpdatedAt}`);
          this.logger.warn(`   New: score=${verifyScore.score}, updatedAt=${verifyScore.updatedAt}`);
        }
      } else {
        this.logger.error(`❌ ERROR: Could not verify updated score - record not found after save!`);
      }
    } else {
      // CREATE new score
      this.logger.log(`➕ Creating new score record...`);
      const indicatorScore = this.indicatorScoreRepository.create(scoreData);
      savedScore = await this.indicatorScoreRepository.save(indicatorScore);
      
      this.logger.log(`✅ Created new score for indicator ${indicatorCode}: ${newScore} (id: ${savedScore.id})`);
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
   * Calculate score for a single indicator
   */
  private calculateSingleIndicatorScore(
    indicatorCode: string,
    category: string,
    formData: Record<string, any>
  ): ScoreCalculation {
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
    calculation: ScoreCalculation;
    formDataSnapshot: Record<string, any> | null;
    updatedBy?: string | null;
    updateReason?: string | null;
    indicatorStatus?: string | null;
  }): Promise<IndicatorScoreHistory> {
    const historyRecord = this.indicatorScoreHistoryRepository.create({
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

    const savedHistory = await this.indicatorScoreHistoryRepository.save(historyRecord);
    
    this.logger.log(
      `📝 Created score history record for indicator ${data.indicatorCode}: ` +
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
      const sectionKey = `section${indicatorCode.replace(".", "_")}`;
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
   * Get score history for a specific indicator
   */
  async getIndicatorScoreHistory(
    submissionId: string,
    indicatorCode: string
  ): Promise<IndicatorScoreHistory[]> {
    return await this.indicatorScoreHistoryRepository.find({
      where: { submissionId, indicatorCode },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get all score history for a submission
   */
  async getSubmissionScoreHistory(submissionId: string): Promise<IndicatorScoreHistory[]> {
    return await this.indicatorScoreHistoryRepository.find({
      where: { submissionId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get score history grouped by indicator
   */
  async getScoreHistoryGroupedByIndicator(
    submissionId: string
  ): Promise<Record<string, IndicatorScoreHistory[]>> {
    const history = await this.getSubmissionScoreHistory(submissionId);
    
    return history.reduce((acc, record) => {
      if (!acc[record.indicatorCode]) {
        acc[record.indicatorCode] = [];
      }
      acc[record.indicatorCode].push(record);
      return acc;
    }, {} as Record<string, IndicatorScoreHistory[]>);
  }

  /**
   * Get all indicator scores for a submission
   */
  async getSubmissionIndicatorScores(submissionId: string): Promise<IndicatorScore[]> {
    return await this.indicatorScoreRepository.find({
      where: { submissionId },
      order: { indicatorCode: 'ASC' },
    });
  }

  /**
   * Get indicator score for a specific indicator
   */
  async getIndicatorScore(submissionId: string, indicatorCode: string): Promise<IndicatorScore | null> {
    return await this.indicatorScoreRepository.findOne({
      where: { submissionId, indicatorCode },
    });
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

  // Individual indicator calculation methods
  private calculateInfraFinancingIndicator(indicatorCode: string, formData: Record<string, any>): ScoreCalculation {
    switch (indicatorCode) {
      case '1.1': {
        const section1_1 = formData.infraFinancing?.section1_1 || {};
        const capexAllocation = parseFloat(section1_1.capitalAllocation) || 0;
        const gsdp = parseFloat(section1_1.gsdpForFY) || 0;
        const capexToGsdpRatio = gsdp > 0 ? (capexAllocation / gsdp) * 100 : 0;
        const score = Math.min(capexToGsdpRatio * 10, 50);
        return {
          indicator: '1.1 % of Capex to GSDP',
          value: capexToGsdpRatio,
          weight: 0.05,
          score,
          maxScore: 50,
        };
      }
      case '1.2': {
        const section1_2 = formData.infraFinancing?.section1_2 || {};
        const actualCapex = parseFloat(section1_2.actualCapex) || 0;
        const budgetaryCapex = parseFloat(section1_2.stateCapexUtilisation) || 0;
        const capexUtilizationRatio = budgetaryCapex > 0 ? (actualCapex / budgetaryCapex) * 100 : 0;
        const score = Math.min(capexUtilizationRatio / 2, 50);
        return {
          indicator: '1.2 % Capex Utilization',
          value: capexUtilizationRatio,
          weight: 0.05,
          score,
          maxScore: 50,
        };
      }
      case '1.3': {
        const section1_3Raw = formData.infraFinancing?.section1_3;
        let section1_3Array: any[] = [];
        let totalULBs = 0;
        
        if (Array.isArray(section1_3Raw)) {
          section1_3Array = section1_3Raw;
        } else if (section1_3Raw && typeof section1_3Raw === 'object') {
          if (Array.isArray(section1_3Raw.ulbList)) {
            section1_3Array = section1_3Raw.ulbList;
          } else {
            section1_3Array = this.normalizeToArray(section1_3Raw);
          }
          totalULBs = parseFloat(section1_3Raw.totalULBs) || 0;
        }
        
        const creditRatedULBs = section1_3Array.length;
        const creditRatedRatio = totalULBs > 0 ? (creditRatedULBs / totalULBs) * 100 : 0;
        const score = Math.min(creditRatedRatio / 2, 50);
        return {
          indicator: '1.3 % of Credit Rated ULBs',
          value: creditRatedRatio,
          weight: 0.05,
          score,
          maxScore: 50,
        };
      }
      case '1.4': {
        const section1_4Raw = formData.infraFinancing?.section1_4;
        let section1_4Array: any[] = [];
        let totalULBsEntered = 0;
        
        if (Array.isArray(section1_4Raw)) {
          section1_4Array = section1_4Raw;
        } else if (section1_4Raw && typeof section1_4Raw === 'object') {
          if (Array.isArray(section1_4Raw.bondList)) {
            section1_4Array = section1_4Raw.bondList;
          } else {
            section1_4Array = this.normalizeToArray(section1_4Raw);
          }
          totalULBsEntered = parseFloat(section1_4Raw.totalULBs) || 0;
        }
        
        // Count all bonds regardless of status (removed approved check)
        const ulbsIssuingBonds = section1_4Array.filter(item => item).length;
        const ulbsBondsRatio = totalULBsEntered > 0 ? (ulbsIssuingBonds / totalULBsEntered) * 100 : 0;
        const score = Math.min(ulbsBondsRatio * 2, 50);
        return {
          indicator: '1.4 % of ULBs Issuing Bonds',
          value: ulbsBondsRatio,
          weight: 0.05,
          score,
          maxScore: 50,
        };
      }
      case '1.5': {
        const section1_5 = formData.infraFinancing?.section1_5 || {};
        const hasIntermediary = section1_5.hasIntermediary === 'yes' || section1_5.hasIntermediary === 'Yes';
        
        let ffiArray: any[] = [];
        if (Array.isArray(section1_5.ffiArray)) {
          ffiArray = section1_5.ffiArray;
        } else {
          ffiArray = this.normalizeToArray(section1_5);
        }
        
        const hasValidFFI = hasIntermediary && ffiArray.length > 0 && ffiArray.some(entry => 
          entry && 
          this.isNonEmpty(entry.organisationName) &&
          this.isNonEmpty(entry.organisationType) &&
          this.isNonEmpty(entry.totalFunding) &&
          this.isNonEmpty(entry.website)
        );
        
        const score = hasValidFFI ? 50 : 0;
        return {
          indicator: '1.5 Functional Financial Intermediary',
          value: hasValidFFI ? 1 : 0,
          weight: 0.05,
          score,
          maxScore: 50,
        };
      }
      default:
        throw new Error(`Unknown indicator code: ${indicatorCode} for category infraFinancing`);
    }
  }

  private calculateInfraDevelopmentIndicator(indicatorCode: string, formData: Record<string, any>): ScoreCalculation {
    switch (indicatorCode) {
      case '2.1': {
        const section2_1Raw = formData.infraDevelopment?.section2_1;
        let section2_1: any[] = [];
        let hasOverarchingPolicy: string | undefined;
        
        if (Array.isArray(section2_1Raw)) {
          section2_1 = section2_1Raw;
        } else if (section2_1Raw && typeof section2_1Raw === 'object') {
          if (Array.isArray(section2_1Raw.infraActArray)) {
            section2_1 = section2_1Raw.infraActArray;
          } else {
            section2_1 = this.normalizeToArray(section2_1Raw);
          }
          hasOverarchingPolicy = section2_1Raw.hasOverarchingPolicy;
        }
        
        // Count entries with files (valid entries)
        const sectorsWithDoc2_1 = section2_1.filter(item => {
          if (!item) return false;
          const hasFiles = item.files && (
            Array.isArray(item.files) ? item.files.length > 0 : 
            (item.files.id || item.files.fileName || item.files.filePath)
          );
          return hasFiles;
        }).length;
        
        // If "yes" (has overarching policy), use existing logic
        if (hasOverarchingPolicy === 'yes') {
          const hasOverarching = section2_1.some(item => 
            item && item.sector && (
              item.sector.toLowerCase() === 'overarching' || 
              item.sector.toLowerCase().includes('overarching')
            )
          );
          const score = (hasOverarching && sectorsWithDoc2_1 > 0) ? 50 : 0;
          return {
            indicator: '2.1 Availability of Infrastructure Act/Policy',
            value: sectorsWithDoc2_1,
            weight: 0.05,
            score,
            maxScore: 50,
          };
        }
        
        // If "no" (no overarching policy), apply new logic:
        // If less than 3 entries, give 0 marks
        // If 3 or more entries, give 10 marks per entry (capped at 50)
        const score = sectorsWithDoc2_1 < 3 ? 0 : Math.min(sectorsWithDoc2_1 * 10, 50);
        
        return {
          indicator: '2.1 Availability of Infrastructure Act/Policy',
          value: sectorsWithDoc2_1,
          weight: 0.05,
          score,
          maxScore: 50,
        };
      }
      case '2.2': {
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
        
        const hasSpecializedEntity = section2_2.length > 0 && section2_2.some(item => {
          if (!item) return false;
          const hasFiles = item.files && (
            Array.isArray(item.files) ? item.files.length > 0 : 
            (item.files.id || item.files.fileName || item.files.filePath)
          );
          return hasFiles;
        });
        
        const score = hasSpecializedEntity ? 50 : 0;
        return {
          indicator: '2.2 Availability of Specialized Entity',
          value: hasSpecializedEntity ? 1 : 0,
          weight: 0.05,
          score,
          maxScore: 50,
        };
      }
      case '2.3': {
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
        
        // NO overarching logic per document - just count sectors with docs
        const sectorsWithDoc2_3 = section2_3.filter(item => {
          if (!item) return false;
          const hasFiles = item.files && (
            Array.isArray(item.files) ? item.files.length > 0 : 
            (item.files.id || item.files.fileName || item.files.filePath)
          );
          return hasFiles;
        }).length;
        
        const score = Math.min(sectorsWithDoc2_3 * 10, 50);
        return {
          indicator: '2.3 Sector Infra Development Plan',
          value: sectorsWithDoc2_3,
          weight: 0.05,
          score,
          maxScore: 50,
        };
      }
      case '2.4': {
        const section2_4Raw = formData.infraDevelopment?.section2_4;
        let section2_4WebsiteLink: string | undefined;
        let hasInvestmentReady: string | undefined;
        
        if (section2_4Raw && typeof section2_4Raw === 'object') {
          section2_4WebsiteLink = section2_4Raw.websiteLink;
          hasInvestmentReady = section2_4Raw.hasInvestmentReady;
        }
        
        // If "no", return 0 marks
        if (hasInvestmentReady === 'no') {
          return {
            indicator: '2.4 Investment Ready Project Pipeline',
            value: 0,
            weight: 0.05,
            score: 0,
            maxScore: 50,
          };
        }
        
        // If "yes", check for website link
        // If website link is present, give full marks (50)
        // If website link is not present, give 0 marks
        const hasSectionWebsiteLink = this.isNonEmpty(section2_4WebsiteLink);
        const score = hasSectionWebsiteLink ? 50 : 0;
        
        return {
          indicator: '2.4 Investment Ready Project Pipeline',
          value: hasSectionWebsiteLink ? 1 : 0,
          weight: 0.05,
          score,
          maxScore: 50,
        };
      }
      case '2.5': {
        const section2_5Raw = formData.infraDevelopment?.section2_5;
        let section2_5WebsiteLink: string | undefined;
        let hasAssetMonetization: string | undefined;
        
        if (section2_5Raw && typeof section2_5Raw === 'object') {
          section2_5WebsiteLink = section2_5Raw.websiteLink;
          hasAssetMonetization = section2_5Raw.hasAssetMonetization;
        }
        
        // If "no", return 0 marks
        if (hasAssetMonetization === 'no') {
          return {
            indicator: '2.5 Asset Monetization Pipeline',
            value: 0,
            weight: 0.05,
            score: 0,
            maxScore: 50,
          };
        }
        
        // If "yes", check for website link
        // If website link is present, give full marks (50)
        // If website link is not present, give 0 marks
        const hasSectionWebsiteLink = this.isNonEmpty(section2_5WebsiteLink);
        const score = hasSectionWebsiteLink ? 50 : 0;
        
        return {
          indicator: '2.5 Asset Monetization Pipeline',
          value: hasSectionWebsiteLink ? 1 : 0,
          weight: 0.05,
          score,
          maxScore: 50,
        };
      }
      default:
        throw new Error(`Unknown indicator code: ${indicatorCode} for category infraDevelopment`);
    }
  }

  private calculatePPPDevelopmentIndicator(indicatorCode: string, formData: Record<string, any>): ScoreCalculation {
    switch (indicatorCode) {
      case '3.1': {
        const section3_1 = formData.pppDevelopment?.section3_1 || {};
        const hasPPPAct = (section3_1.available === 'yes' || section3_1.available === 'Yes') && 
                          section3_1.file && (section3_1.file.id || section3_1.file.fileName || section3_1.file.filePath);
        const score = hasPPPAct ? 50 : 0;
        return {
          indicator: '3.1 Availability of PPP Act/Policy',
          value: hasPPPAct ? 1 : 0,
          weight: 0.05,
          score,
          maxScore: 50,
        };
      }
      case '3.2': {
        const section3_2 = formData.pppDevelopment?.section3_2 || {};
        const hasPPPCell = (section3_2.available === 'yes' || section3_2.available === 'Yes') && 
                           section3_2.file && (section3_2.file.id || section3_2.file.fileName || section3_2.file.filePath);
        const score = hasPPPCell ? 50 : 0;
        return {
          indicator: '3.2 Functional PPP Cell/Unit',
          value: hasPPPCell ? 1 : 0,
          weight: 0.05,
          score,
          maxScore: 50,
        };
      }
      case '3.3': {
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
        
        const score = Math.min(vgfProposals * 5, 50);
        return {
          indicator: '3.3 Proposals under VGF/IIPDF',
          value: vgfProposals,
          weight: 0.05,
          score,
          maxScore: 50,
        };
      }
      case '3.4': {
        const section3_4 = formData.pppDevelopment?.section3_4 || {};
        
        // A1 = Total of all TPC of all Projects (sum of all project costs)
        // This is auto-calculated in frontend as totalProjectCostAwarded
        const totalCostBankablePPP = parseFloat(section3_4.totalProjectCostAwarded) || 0;
        
        // A2 = Total Budgeted capital allocation
        const totalCostAllInfra = parseFloat(section3_4.totalProjectsAwarded) || 0;
        
        // Calculate percentage: % = (A1 / A2) × 100
        const proportionPercentage = totalCostAllInfra > 0 ? (totalCostBankablePPP / totalCostAllInfra) * 100 : 0;
        
        // Calculate marks: Marks = % × 2, max 100
        const score = Math.min(proportionPercentage * 2, 100);
        
        return {
          indicator: '3.4 Proportion of TPC of PPP Projects',
          value: proportionPercentage,
          weight: 0.1,
          score,
          maxScore: 100,
        };
      }
      default:
        throw new Error(`Unknown indicator code: ${indicatorCode} for category pppDevelopment`);
    }
  }

  private calculateInfraEnablersIndicator(indicatorCode: string, formData: Record<string, any>): ScoreCalculation {
    switch (indicatorCode) {
      case '4.1': {
        const section4_1 = formData.infraEnablers?.section4_1 || {};
        const allEligible = (section4_1.available === 'yes' || section4_1.available === 'Yes') && 
                            (
                              this.isNonEmpty(section4_1.websiteLink) ||
                              (section4_1.file && (section4_1.file.id || section4_1.file.fileName || section4_1.file.filePath)) ||
                              this.isNonEmpty(section4_1.notification)
                            );
        const score = allEligible ? 70 : 0; // CORRECTED: 70 marks instead of 50
        return {
          indicator: '4.1 Availability and use of State/UT PMG portal',
          value: allEligible ? 1 : 0,
          weight: 0.07,
          score,
          maxScore: 70,
        };
      }
      case '4.2': {
        const section4_2 = formData.infraEnablers?.section4_2 || {};
        let projectsArray: any[] = [];
        
        if (Array.isArray(section4_2.projects)) {
          projectsArray = section4_2.projects;
        } else {
          projectsArray = this.normalizeToArray(section4_2);
        }
        
        const projectsWithDocs = projectsArray.filter(item => {
          if (!item) return false;
          const hasFile = item.file && (
            Array.isArray(item.file) ? item.file.length > 0 :
            (item.file.id || item.file.fileName || item.file.filePath)
          );
          return hasFile;
        }).length;
        
        const score = Math.min(projectsWithDocs * 10, 30); // CORRECTED: A1 × 10, max 30
        return {
          indicator: '4.2 Adoption of PM GatiShakti NMP',
          value: projectsWithDocs,
          weight: 0.03,
          score,
          maxScore: 30,
        };
      }
      case '4.3': {
        const section4_3 = formData.infraEnablers?.section4_3 || {};
        const adoptedADR = (section4_3.adopted === 'yes' || section4_3.adopted === 'Yes') && 
                           section4_3.file && (section4_3.file.id || section4_3.file.fileName || section4_3.file.filePath);
        const score = adoptedADR ? 50 : 0;
        return {
          indicator: '4.3 Adoption of ADR',
          value: adoptedADR ? 1 : 0,
          weight: 0.05,
          score,
          maxScore: 50,
        };
      }
      case '4.4': {
        const section4_4 = formData.infraEnablers?.section4_4 || {};
        let practicesArray: any[] = [];
        
        if (Array.isArray(section4_4.practices)) {
          practicesArray = section4_4.practices;
        } else {
          practicesArray = this.normalizeToArray(section4_4);
        }
        
        const validatedPractices = practicesArray.filter(practice => {
          if (!practice) return false;
          const hasFile = practice.file && (
            Array.isArray(practice.file) ? practice.file.length > 0 :
            (practice.file.id || practice.file.fileName || practice.file.filePath)
          );
          return hasFile;
        }).length;
        
        const score = Math.min(validatedPractices * 10, 50);
        return {
          indicator: '4.4 Innovative Practices',
          value: validatedPractices,
          weight: 0.05,
          score,
          maxScore: 50,
        };
      }
      case '4.5': {
        const section4_5Raw = formData.infraEnablers?.section4_5;
        let section4_5: any[] = [];
        
        if (Array.isArray(section4_5Raw)) {
          section4_5 = section4_5Raw;
        } else if (section4_5Raw && typeof section4_5Raw === 'object') {
          if (Array.isArray(section4_5Raw.capacityArray)) {
            section4_5 = section4_5Raw.capacityArray;
          } else {
            section4_5 = this.normalizeToArray(section4_5Raw);
          }
        }
        
        // Get current financial year
        const currentFY = this.getCurrentFinancialYear();
        
        // Filter entries that belong to current financial year
        const validParticipants = section4_5.filter(entry => {
          if (!entry || !entry.trainingPeriod) return false;
          
          // Parse trainingPeriod (format: MM/YY)
          const trainingPeriod = String(entry.trainingPeriod).trim();
          if (!trainingPeriod.includes('/') || trainingPeriod.length !== 5) {
            return false;
          }
          
          const [monthStr, yearStr] = trainingPeriod.split('/');
          const month = parseInt(monthStr, 10);
          const yearShort = parseInt(yearStr, 10);
          
          if (isNaN(month) || isNaN(yearShort) || month < 1 || month > 12) {
            return false;
          }
          
          // Convert YY to full year (assuming 2000-2099 range)
          const fullYear = 2000 + yearShort;
          
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
          return entryFY === currentFY;
        }).length;
        
        const score = Math.min(validParticipants * 1, 50);
        return {
          indicator: '4.5 Capacity Building - Officer Participation',
          value: validParticipants,
          weight: 0.05,
          score,
          maxScore: 50,
        };
      }
      default:
        throw new Error(`Unknown indicator code: ${indicatorCode} for category infraEnablers`);
    }
  }

  // 1. INFRA FINANCING CALCULATIONS (250 marks)
  private calculateInfraFinancingScore(formData: Record<string, any>, calculations: ScoreCalculation[]): number {
    let categoryScore = 0;
    
    // Use individual indicator calculation methods
    ['1.1', '1.2', '1.3', '1.4', '1.5'].forEach(code => {
      const calc = this.calculateInfraFinancingIndicator(code, formData);
      calculations.push(calc);
      categoryScore += calc.score;
    });

    return categoryScore;
  }

  /**
   * Helper function to safely check if a value is non-empty
   * Handles both string and number types to prevent type errors
   */
  private isNonEmpty(value: any): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'number') return value > 0 || !isNaN(value);
    if (typeof value === 'string') return value.trim() !== '';
    return false;
  }

  /**
   * Helper function to safely get string value (handles both string and number)
   */
  private getStringValue(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return value.trim();
    return String(value);
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
    
    // Use individual indicator calculation methods
    ['2.1', '2.2', '2.3', '2.4', '2.5'].forEach(code => {
      const calc = this.calculateInfraDevelopmentIndicator(code, formData);
      calculations.push(calc);
      categoryScore += calc.score;
    });

    return categoryScore;
  }

  // 3. PPP DEVELOPMENT CALCULATIONS (250 marks)
  private calculatePPPDevelopmentScore(formData: Record<string, any>, calculations: ScoreCalculation[]): number {
    let categoryScore = 0;
    
    // Use individual indicator calculation methods
    ['3.1', '3.2', '3.3', '3.4'].forEach(code => {
      const calc = this.calculatePPPDevelopmentIndicator(code, formData);
      calculations.push(calc);
      categoryScore += calc.score;
    });

    return categoryScore;
  }

  // 4. INFRA ENABLERS CALCULATIONS (250 marks)
  private calculateInfraEnablersScore(formData: Record<string, any>, calculations: ScoreCalculation[]): number {
    let categoryScore = 0;
    
    // Use individual indicator calculation methods
    ['4.1', '4.2', '4.3', '4.4', '4.5'].forEach(code => {
      const calc = this.calculateInfraEnablersIndicator(code, formData);
      calculations.push(calc);
      categoryScore += calc.score;
    });

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

  /**
   * Save a manual score update (separate from automatic score calculation)
   * This does NOT modify the system-generated score in indicator_scores table
   */
  async saveManualScoreUpdate(
    submissionId: string,
    indicatorCode: string,
    category: string,
    updatedScore: number,
    maxScore: number,
    updateReason: string,
    userId: string
  ): Promise<ManualScoreUpdate> {
    this.logger.log(
      `💾 Saving manual score update for indicator ${indicatorCode} in submission ${submissionId}`
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

    // Get the current system-generated score (this is NOT modified)
    const currentScore = await this.getIndicatorScore(submissionId, indicatorCode);
    const systemScore = currentScore ? parseFloat(currentScore.score.toString()) : 0;

    // Create manual update record
    const manualUpdate = this.manualScoreUpdateRepository.create({
      submissionId,
      indicatorCode,
      category,
      systemScore,
      manualUpdatedScore: updatedScore,
      maxScore,
      updateReason,
      updatedBy: userId,
    });

    const savedUpdate = await this.manualScoreUpdateRepository.save(manualUpdate);

    this.logger.log(
      `✅ Saved manual score update for indicator ${indicatorCode}: ` +
      `System Score: ${systemScore} → Manual Updated Score: ${updatedScore} ` +
      `(Reason: ${updateReason}) at ${savedUpdate.createdAt}`
    );

    return savedUpdate;
  }

  /**
   * Get manual score update history for an indicator
   */
  async getManualScoreUpdateHistory(
    submissionId: string,
    indicatorCode: string
  ): Promise<ManualScoreUpdate[]> {
    return await this.manualScoreUpdateRepository.find({
      where: { submissionId, indicatorCode },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get the latest manual score update for an indicator
   */
  async getLatestManualScoreUpdate(
    submissionId: string,
    indicatorCode: string
  ): Promise<ManualScoreUpdate | null> {
    const updates = await this.manualScoreUpdateRepository.find({
      where: { submissionId, indicatorCode },
      order: { createdAt: 'DESC' },
      take: 1,
    });

    return updates.length > 0 ? updates[0] : null;
  }
}