import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../../entities/user.entity";
import { Indicator } from "../../entities/indicator.entity";
import { UserIndicatorScope } from "../../entities/user-indicator-scope.entity";
import { Submission } from "../../entities/submission.entity";
import { FinalScore } from "../../entities/final-score.entity";
import { AuditLog } from "../../entities/audit-log.entity";
import { MinistrySubmissionIndicator } from "../../ministry/entities/ministry-submission-indicator.entity";
import { MinistrySubmission } from "../../ministry/entities/ministry-submission.entity";
import { MinistrySubmissionData } from "../../ministry/entities/ministry-submission-data.entity";
import { MinistrySubmissionComment } from "../../ministry/entities/ministry-submission-comment.entity";
import { Form } from "../../ministry/entities/form.entity";
import { MinistryIndicatorScore } from "../../entities/ministry-indicator-score.entity";
import { MinistryIndicatorScoreHistory } from "../../entities/ministry-indicator-score-history.entity";
import { MinistryFinalScore } from "../../entities/ministry-final-score.entity";
import { MinistryManualScoreUpdate } from "../../entities/ministry-manual-score-update.entity";
import { IndicatorDetail } from "../../ministry/entities/indicator-detail.entity";
import { UserService } from "./user.service";
import { UserController } from "./user.controller";
import { UserIndicatorsController } from "./user-indicators.controller";
import { IndicatorModule } from "../indicator/indicator.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Indicator,
      UserIndicatorScope,
      Submission,
      FinalScore,
      AuditLog,
      MinistrySubmissionIndicator,
      MinistrySubmission,
      MinistrySubmissionData,
      MinistrySubmissionComment,
      Form,
      MinistryIndicatorScore,
      MinistryIndicatorScoreHistory,
      MinistryFinalScore,
      MinistryManualScoreUpdate,
      IndicatorDetail,
    ]),
    IndicatorModule,
  ],
  controllers: [UserController, UserIndicatorsController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
