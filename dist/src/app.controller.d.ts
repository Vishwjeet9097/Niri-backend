import { DataSource } from 'typeorm';
import { AppService } from './app.service';
export declare class AppController {
    private readonly appService;
    private readonly dataSource;
    constructor(appService: AppService, dataSource: DataSource);
    getHello(): string;
    getHealth(): Promise<{
        status: boolean;
        data: {
            service: string;
            timestamp: string;
            database: {
                connected: boolean;
                tables: any;
                requiredTables: string[];
                foundTables: any;
                error?: undefined;
            };
            uptime: number;
            memory: NodeJS.MemoryUsage;
        };
        message: string;
        timestamp: string;
    } | {
        status: boolean;
        data: {
            service: string;
            timestamp: string;
            database: {
                connected: boolean;
                error: any;
                tables?: undefined;
                requiredTables?: undefined;
                foundTables?: undefined;
            };
            uptime: number;
            memory: NodeJS.MemoryUsage;
        };
        message: string;
        timestamp: string;
    }>;
}
