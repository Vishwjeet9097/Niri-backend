import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Submission } from '../../entities/submission.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { Indicator } from '@/entities/indicator.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Submission, Indicator])],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
