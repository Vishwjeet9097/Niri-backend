import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Submission } from '../entities/submission.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { FinalScore } from '../entities/final-score.entity';

@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  constructor(private configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      host: this.configService.get('DB_HOST'),
      port: this.configService.get('DB_PORT'),
      username: this.configService.get('DB_USERNAME'),
      password: this.configService.get('DB_PASSWORD'),
      database: this.configService.get('DB_NAME'),
      entities: [User, Submission, AuditLog, FinalScore],
      synchronize: this.configService.get('NODE_ENV') === 'development',
      logging: this.configService.get('NODE_ENV') === 'development',
      migrations: ['dist/migrations/*.js'],
      migrationsRun: false,

      // 🔥 CRITICAL: Enhanced Connection Configuration for Robust Startup
      connectTimeoutMS: 10000, // 10 seconds connection timeout

      // Connection pool settings for stability
      extra: {
        max: 20, // Maximum number of connections
        min: 5, // Minimum number of connections
        idleTimeoutMillis: 30000, // 30 seconds idle timeout
        connectionTimeoutMillis: 10000, // 10 seconds connection timeout
      },

      // Retry configuration
      retryAttempts: 3,
      retryDelay: 3000, // 3 seconds between retries
    };
  }
}
