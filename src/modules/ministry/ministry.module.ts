import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ministry } from '../../entities/ministry.entity';
import { MinistryService } from './ministry.service';
import { MinistryController } from './ministry.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Ministry])],
  controllers: [MinistryController],
  providers: [MinistryService],
  exports: [MinistryService],
})
export class MinistryModule {}
