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

    // Define scoring methodology based on BRD requirements
    const scoringRules = {
      // Example scoring rules - these should be based on actual BRD requirements
      capexToGsdpRatio: {
        weight: 0.25,
        maxScore: 25,
        calculation: (value: number) => Math.min(value * 10, 25), // 10 marks per 1%
      },
      infrastructureInvestment: {
        weight: 0.2,
        maxScore: 20,
        calculation: (value: number) => Math.min(value * 2, 20), // 2 marks per crore
      },
      projectCompletionRate: {
        weight: 0.2,
        maxScore: 20,
        calculation: (value: number) => value * 0.2, // 0.2 marks per %
      },
      qualityIndex: {
        weight: 0.15,
        maxScore: 15,
        calculation: (value: number) => value * 0.15, // 0.15 marks per point
      },
      sustainabilityScore: {
        weight: 0.1,
        maxScore: 10,
        calculation: (value: number) => value * 0.1, // 0.1 marks per point
      },
      innovationIndex: {
        weight: 0.1,
        maxScore: 10,
        calculation: (value: number) => value * 0.1, // 0.1 marks per point
      },
    };

    // Calculate scores for each indicator
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
      methodology:
        'NIRI Scoring Methodology v1.0 - Based on BRD requirements for infrastructure readiness assessment',
    };
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
