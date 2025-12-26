import { Controller } from '@nestjs/common';
import { MinistryFormRetrieveService } from './ministry.form.retrieve.service';

@Controller('ministry.form.retrieve')
export class MinistryFormRetrieveController {
  constructor(private readonly ministryFormRetrieveService: MinistryFormRetrieveService) {}
}
