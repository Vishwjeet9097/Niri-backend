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
export declare class ScoringService {
    private submissionRepository;
    private finalScoreRepository;
    constructor(submissionRepository: Repository<Submission>, finalScoreRepository: Repository<FinalScore>);
    calculateScore(submissionId: string, approvedBy: string): Promise<FinalScore>;
    private performScoreCalculation;
    getScoreRankings(): Promise<any[]>;
    getStateScore(stateUt: string): Promise<FinalScore | null>;
    getScoreStatistics(): Promise<any>;
}
