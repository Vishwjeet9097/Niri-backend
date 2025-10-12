import { Repository } from 'typeorm';
import { FinalScore } from '../../entities/final-score.entity';
import { Submission } from '../../entities/submission.entity';
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
export declare class ReportService {
    private finalScoreRepository;
    private submissionRepository;
    constructor(finalScoreRepository: Repository<FinalScore>, submissionRepository: Repository<Submission>);
    getRankings(): Promise<RankingData[]>;
    getReportData(): Promise<ReportData>;
    getStateReport(stateUt: string): Promise<any>;
    exportRankings(format?: 'json' | 'csv'): Promise<any>;
    getSubmissionStatusReport(): Promise<any>;
}
