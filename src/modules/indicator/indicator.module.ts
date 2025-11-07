import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Indicator } from "../../entities/indicator.entity";
import { UserIndicatorScope } from "../../entities/user-indicator-scope.entity";
import { User } from "../../entities/user.entity";


import { Submission } from '../../entities/submission.entity';
import { IndicatorService } from './indicator.service';
import { IndicatorController } from './indicator.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Indicator, UserIndicatorScope, User, Submission])],
  controllers: [IndicatorController],
  providers: [IndicatorService],
  exports: [IndicatorService],
})
export class IndicatorModule {}
