import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Submission } from '../../entities/submission.entity';
import { Indicator } from '../../entities/indicator.entity';
import { IndicatorStatusService } from './indicator-status.service';

@Module({
  imports: [TypeOrmModule.forFeature([Submission, Indicator])],
  providers: [IndicatorStatusService],
  exports: [IndicatorStatusService],
})
export class CommonModule {}
