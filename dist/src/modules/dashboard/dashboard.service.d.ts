import { Repository } from 'typeorm';
import { Submission, SubmissionStatus } from '../../entities/submission.entity';
import { UserRole } from '../../entities/user.entity';
export interface DashboardSummary {
    pendingSubmissions: number;
    approvedSubmissions: number;
    rejectedSubmissions: number;
    totalSubmissions: number;
    averageReviewTime: number;
    overdueSubmissions: number;
    submissionsByStatus: Record<SubmissionStatus, number>;
    submissionsByMonth: Array<{
        month: string;
        count: number;
    }>;
}
export declare class DashboardService {
    private submissionRepository;
    constructor(submissionRepository: Repository<Submission>);
    getDashboardSummary(userRole: UserRole, userStateUt: string): Promise<DashboardSummary>;
    getRoleSpecificKPIs(userRole: UserRole, userStateUt: string): Promise<any>;
    getRecentActivities(userRole: UserRole, userStateUt: string): Promise<any[]>;
    private getStatusLabel;
    private getStatusColor;
}
