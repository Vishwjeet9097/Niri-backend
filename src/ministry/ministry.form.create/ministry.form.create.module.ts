import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MinistryFormCreateService } from './ministry.form.create.service';
import { MinistryFormCreateController } from './ministry.form.create.controller';
import { IndicatorDetail } from '../entities/indicator-detail.entity';
import { IndicatorSubsection } from '../entities/indicator-subsection.entity';
import { InputField } from '../entities/input-field.entity';

@Module({
  imports: [TypeOrmModule.forFeature([IndicatorDetail, IndicatorSubsection, InputField])],
  controllers: [MinistryFormCreateController],
  providers: [MinistryFormCreateService],
  exports: [MinistryFormCreateService],
})
export class MinistryFormCreateModule {}
