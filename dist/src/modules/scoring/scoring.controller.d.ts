import { ScoringService } from './scoring.service';
export declare class ScoringController {
    private readonly scoringService;
    constructor(scoringService: ScoringService);
    getRankings(req: any): Promise<{
        status: boolean;
        data: any[];
        message: string;
        timestamp: string;
    }>;
    getStatistics(req: any): Promise<{
        status: boolean;
        data: any;
        message: string;
        timestamp: string;
    }>;
    getStateScore(stateUt: string, req: any): Promise<{
        status: boolean;
        data: any;
        message: string;
        timestamp: string;
    }>;
    calculateScore(submissionId: string, req: any): Promise<{
        status: boolean;
        data: import("./scoring.service").ScoreBreakdown;
        message: string;
        timestamp: string;
    }>;
}
