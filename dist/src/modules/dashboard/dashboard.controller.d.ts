import { DashboardService } from './dashboard.service';
export declare class DashboardController {
    private readonly dashboardService;
    constructor(dashboardService: DashboardService);
    getSummary(req: any): Promise<import("./dashboard.service").DashboardSummary>;
    getKPIs(req: any): Promise<any>;
    getRecentActivities(req: any): Promise<any[]>;
}
