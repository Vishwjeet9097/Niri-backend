import { DataSource } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { config } from "dotenv";

config();

const configService = new ConfigService();

const isProduction = configService.get("NODE_ENV") === "production";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: configService.get("DB_HOST"),
  port: configService.get("DB_PORT"),
  username: configService.get("DB_USERNAME"),
  password: configService.get("DB_PASSWORD"),
  database: configService.get("DB_DATABASE") || "niri_dev",
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  extra: isProduction
    ? {
        ssl: { rejectUnauthorized: false },
      }
    : {},
  entities: ["src/entities/*.entity.ts"],
  migrations: ["src/migrations/*.ts"],
  synchronize: false,
  logging: configService.get("NODE_ENV") === "development",
  ssl: false,
});
