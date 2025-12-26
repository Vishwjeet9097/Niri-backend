import { Test, TestingModule } from '@nestjs/testing';
import { MinistryFormCreateService } from './ministry.form.create.service';

describe('MinistryFormCreateService', () => {
  let service: MinistryFormCreateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MinistryFormCreateService],
    }).compile();

    service = module.get<MinistryFormCreateService>(MinistryFormCreateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
