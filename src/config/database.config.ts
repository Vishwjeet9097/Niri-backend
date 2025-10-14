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
    return {
      type: "postgres",
      host: this.configService.get("DB_HOST"),
      port: parseInt(this.configService.get("DB_PORT") || "5432", 10),
      username: this.configService.get("DB_USERNAME"),
      password: this.configService.get("DB_PASSWORD"),
      database: this.configService.get("DB_NAME"),
      ssl: { rejectUnauthorized: false },
      extra: {
        ssl: { rejectUnauthorized: false },
      },
      synchronize: false,
      autoLoadEntities: true,
    };
  }
}
