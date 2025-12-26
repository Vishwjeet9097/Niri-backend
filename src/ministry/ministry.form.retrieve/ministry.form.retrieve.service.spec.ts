import { Test, TestingModule } from '@nestjs/testing';
import { MinistryFormRetrieveService } from './ministry.form.retrieve.service';

describe('MinistryFormRetrieveService', () => {
  let service: MinistryFormRetrieveService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MinistryFormRetrieveService],
    }).compile();

    service = module.get<MinistryFormRetrieveService>(MinistryFormRetrieveService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
