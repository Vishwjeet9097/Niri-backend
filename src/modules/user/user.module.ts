import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../../entities/user.entity";
import { Indicator } from "../../entities/indicator.entity";
import { UserIndicatorScope } from "../../entities/user-indicator-scope.entity";
import { UserService } from "./user.service";
import { UserController } from "./user.controller";
import { UserIndicatorsController } from "./user-indicators.controller";
import { IndicatorModule } from "../indicator/indicator.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Indicator, UserIndicatorScope]),
    IndicatorModule,
  ],
  controllers: [UserController, UserIndicatorsController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
