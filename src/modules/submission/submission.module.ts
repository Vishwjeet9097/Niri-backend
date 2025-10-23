import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Submission } from "../../entities/submission.entity";
import { FinalScore } from "../../entities/final-score.entity";
import { UserIndicatorScope } from "../../entities/user-indicator-scope.entity";
import { Indicator } from "../../entities/indicator.entity";
import { SubmissionService } from "./submission.service";
import { SubmissionController } from "./submission.controller";
import { IndicatorAccessMiddleware } from "../../middleware/indicator-access.middleware";
import { ScoringModule } from "../scoring/scoring.module";
import { StorageModule } from "../storage/storage.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Submission,
      FinalScore,
      UserIndicatorScope,
      Indicator,
    ]),
    ScoringModule,
    StorageModule,
  ],
  controllers: [SubmissionController],
  providers: [SubmissionService, IndicatorAccessMiddleware],
  exports: [SubmissionService],
})
export class SubmissionModule {}
