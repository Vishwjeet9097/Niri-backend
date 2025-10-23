import { Module, NestModule, MiddlewareConsumer } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ClsModule } from "nestjs-cls";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { DatabaseConfig } from "./config/database.config";
import { AuthModule } from "./modules/auth/auth.module";
import { UserModule } from "./modules/user/user.module";
import { StateModule } from "./modules/state/state.module";
import { SubmissionModule } from "./modules/submission/submission.module";
import { AuditModule } from "./modules/audit/audit.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { ReportModule } from "./modules/report/report.module";
import { StorageModule } from "./modules/storage/storage.module";
import { ScoringModule } from "./modules/scoring/scoring.module";
import { ValidationModule } from "./modules/validation/validation.module";
import { IndicatorModule } from "./modules/indicator/indicator.module";
import { AuditMiddleware } from "./middleware/audit.middleware";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    TypeOrmModule.forRootAsync({
      useClass: DatabaseConfig,
    }),
    AuthModule,
    UserModule,
    StateModule,
    SubmissionModule,
    AuditModule,
    DashboardModule,
    ReportModule,
    StorageModule,
    ScoringModule,
    ValidationModule,
    IndicatorModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuditMiddleware).forRoutes("*");
  }
}
