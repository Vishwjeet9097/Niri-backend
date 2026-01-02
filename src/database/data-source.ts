import { DataSource } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { config } from "dotenv";
import { Form } from "../ministry/entities/form.entity";
import { IndicatorDetail } from "../ministry/entities/indicator-detail.entity";
import { IndicatorSubsection } from "../ministry/entities/indicator-subsection.entity";
import { InputField } from "../ministry/entities/input-field.entity";
import { MinistrySubmission } from "../ministry/entities/ministry-submission.entity";
import { MinistrySubmissionIndicator } from "../ministry/entities/ministry-submission-indicator.entity";
import { MinistrySubmissionData } from "../ministry/entities/ministry-submission-data.entity";

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
  ssl: false, // Disable SSL for local development
  extra: {
    ssl: false, // Disable SSL for local development
  },
  entities: [
    "src/entities/*.entity.ts",
    Form,
    IndicatorDetail,
    IndicatorSubsection,
    InputField,
    MinistrySubmission,
    MinistrySubmissionIndicator,
    MinistrySubmissionData,
  ],
  migrations: ["src/migrations/*.ts"],
  synchronize: false,
});
