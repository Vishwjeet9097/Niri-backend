import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FinalScore } from '../../entities/final-score.entity';
import { Submission } from '../../entities/submission.entity';
import { UserRole } from '../../entities/user.entity';

export interface RankingData {
  rank: number;
  stateUt: string;
  totalScore: number;
  percentage: number;
  approvedAt: Date;
  submissionId: string;
}

export interface ReportData {
  rankings: RankingData[];
  statistics: {
    totalStates: number;
    averageScore: number;
    highestScore: number;
    lowestScore: number;
    scoreDistribution: Record<string, number>;
  };
  stateComparison: Array<{
    stateUt: string;
    score: number;
    rank: number;
    percentile: number;
  }>;
}

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(FinalScore)
    private finalScoreRepository: Repository<FinalScore>,
    @InjectRepository(Submission)
    private submissionRepository: Repository<Submission>,
  ) {}

  async getRankings(): Promise<RankingData[]> {
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

  async getReportData(): Promise<ReportData> {
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

    // Score distribution
    const scoreDistribution = {
      '90-100': rankings.filter(r => r.totalScore >= 90).length,
      '80-89': rankings.filter(r => r.totalScore >= 80 && r.totalScore < 90).length,
      '70-79': rankings.filter(r => r.totalScore >= 70 && r.totalScore < 79).length,
      '60-69': rankings.filter(r => r.totalScore >= 60 && r.totalScore < 70).length,
      '50-59': rankings.filter(r => r.totalScore >= 50 && r.totalScore < 60).length,
      'Below 50': rankings.filter(r => r.totalScore < 50).length,
    };

    // State comparison with percentiles
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

  async getStateReport(stateUt: string): Promise<any> {
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

  async exportRankings(format: 'json' | 'csv' = 'json'): Promise<any> {
    const rankings = await this.getRankings();
    
    if (format === 'csv') {
      const csvHeaders = 'Rank,State/UT,Total Score,Percentage,Approved At,Submission ID\n';
      const csvRows = rankings.map(r => 
        `${r.rank},"${r.stateUt}",${r.totalScore},${r.percentage},"${r.approvedAt.toISOString()}",${r.submissionId}`
      ).join('\n');
      
      return csvHeaders + csvRows;
    }

    return rankings;
  }

  async getSubmissionStatusReport(): Promise<any> {
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
}
