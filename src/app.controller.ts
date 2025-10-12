import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly dataSource: DataSource,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async getHealth() {
    try {
      // Test database connectivity
      await this.dataSource.query('SELECT 1 as test');

      // Check if required tables exist
      const tables = await this.dataSource.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('users', 'submissions', 'audit_logs', 'final_scores')
      `);

      return {
        status: true,
        data: {
          service: 'NIRI Backend API',
          timestamp: new Date().toISOString(),
          database: {
            connected: true,
            tables: tables.length,
            requiredTables: ['users', 'submissions', 'audit_logs', 'final_scores'],
            foundTables: tables.map((t) => t.table_name),
          },
          uptime: process.uptime(),
          memory: process.memoryUsage(),
        },
        message: 'Health check successful',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: false,
        data: {
          service: 'NIRI Backend API',
          timestamp: new Date().toISOString(),
          database: {
            connected: false,
            error: error.message,
          },
          uptime: process.uptime(),
          memory: process.memoryUsage(),
        },
        message: 'Health check failed',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
