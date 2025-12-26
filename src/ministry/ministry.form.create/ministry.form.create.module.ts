import { Module } from '@nestjs/common';
import { MinistryFormCreateService } from './ministry.form.create.service';
import { MinistryFormCreateController } from './ministry.form.create.controller';

@Module({
  controllers: [MinistryFormCreateController],
  providers: [MinistryFormCreateService],
})
export class MinistryFormCreateModule {}
