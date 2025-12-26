import { Controller } from '@nestjs/common';
import { MinistryFormCreateService } from './ministry.form.create.service';

@Controller('ministry.form.create')
export class MinistryFormCreateController {
  constructor(private readonly ministryFormCreateService: MinistryFormCreateService) {}
}
