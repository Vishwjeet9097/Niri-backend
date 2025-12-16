import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm'; 
import { UlbController } from './ulb.controller';
import { UlbMaster } from '../../entities/ulb-master.entity';
import { UlbService } from './ulb.service';

@Module({
  imports: [TypeOrmModule.forFeature([UlbMaster])],
  controllers: [UlbController],
  providers: [UlbService],
  exports: [UlbService],
})
export class UlbModule {}