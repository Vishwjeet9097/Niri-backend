import { Module } from '@nestjs/common';
import { MinistryFormRetrieveService } from './ministry.form.retrieve.service';
import { MinistryFormRetrieveController } from './ministry.form.retrieve.controller';

@Module({
  controllers: [MinistryFormRetrieveController],
  providers: [MinistryFormRetrieveService],
})
export class MinistryFormRetrieveModule {}
