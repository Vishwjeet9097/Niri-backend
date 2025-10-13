import { Submission } from './submission.entity';
export declare class FinalScore {
    id: string;
    submissionId: string;
    submission: Submission;
    stateUt: string;
    totalScore: number;
    scoreBreakdown: Record<string, any>;
    calculationMethodology: string;
    approvedBy: string;
    categoryScores: Record<string, number>;
    scoringVersion: string;
    createdAt: Date;
    updatedAt: Date;
}
