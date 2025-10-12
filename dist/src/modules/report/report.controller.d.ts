import { Response } from 'express';
import { ReportService } from './report.service';
export declare class ReportController {
    private readonly reportService;
    constructor(reportService: ReportService);
    getRankings(): Promise<import("./report.service").RankingData[]>;
    getFullReport(): Promise<import("./report.service").ReportData>;
    getStateReport(stateUt: string, req: any): Promise<any>;
    exportRankings(format: 'json' | 'csv', res: Response): Promise<void>;
    getSubmissionStatusReport(): Promise<any>;
}
