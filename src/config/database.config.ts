import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from "@nestjs/typeorm";
import { User } from "../entities/user.entity";
import { Submission } from "../entities/submission.entity";
import { AuditLog } from "../entities/audit-log.entity";
import { FinalScore } from "../entities/final-score.entity";

@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  constructor(private readonly configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: "postgres",
      host: this.configService.get<string>("DB_HOST"),
      port: parseInt(this.configService.get<string>("DB_PORT") || "5432", 10),
      username: this.configService.get<string>("DB_USERNAME"),
      password: this.configService.get<string>("DB_PASSWORD"),
      database: this.configService.get<string>("DB_DATABASE"),

      ssl: false,
      extra: {
        ssl: false,
        connectionTimeoutMillis: 10000,
      },

      entities: [User, Submission, AuditLog, FinalScore],
      autoLoadEntities: true,
      synchronize: false,
      logging: true,
    };
  }
}
