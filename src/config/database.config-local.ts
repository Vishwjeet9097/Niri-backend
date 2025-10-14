import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from "@nestjs/typeorm";
import { User } from "../entities/user.entity";

import { Submission } from "../entities/submission.entity";
import { AuditLog } from "../entities/audit-log.entity";
import { FinalScore } from "../entities/final-score.entity";

@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  constructor(private configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const isProduction = this.configService.get("NODE_ENV") === "production";
    const dbHost = this.configService.get("DB_HOST");
    
    // Only use SSL for production or when explicitly configured
    const sslConfig = isProduction || dbHost !== "localhost" 
      ? { rejectUnauthorized: false } 
      : false;

    return {
      type: "postgres",
      host: dbHost,
      port: parseInt(this.configService.get("DB_PORT") || "5432", 10),
      username: this.configService.get("DB_USERNAME"),
      password: this.configService.get("DB_PASSWORD"),
      database: this.configService.get("DB_NAME"),
      ssl: sslConfig,
      extra: sslConfig ? { ssl: sslConfig } : {},
      synchronize: false,
      autoLoadEntities: true,
    };
  }
}
