import { Repository } from 'typeorm';
import { Submission } from '../../entities/submission.entity';
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
export interface CategoryScore {
    category: string;
    score: number;
    maxScore: number;
    percentage: number;
}
export declare class ScoringService {
    private submissionRepository;
    private finalScoreRepository;
    private readonly logger;
    constructor(submissionRepository: Repository<Submission>, finalScoreRepository: Repository<FinalScore>);
    calculateScore(submissionId: string, userId: string): Promise<ScoreBreakdown>;
    private performScoreCalculation;
    private calculateInfraFinancingScore;
    private calculateInfraDevelopmentScore;
    private calculatePPPDevelopmentScore;
    private calculateInfraEnablersScore;
    getScoreRankings(): Promise<any[]>;
    getScoreStatistics(): Promise<any>;
    getStateScore(stateUt: string): Promise<any>;
    getAllScores(page?: number, limit?: number): Promise<{
        scores: any[];
        total: number;
        page: number;
        totalPages: number;
    }>;
}
