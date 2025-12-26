import { Test, TestingModule } from '@nestjs/testing';
import { MinistryFormSubmissionService } from './ministry.form.submission.service';

describe('MinistryFormSubmissionService', () => {
  let service: MinistryFormSubmissionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MinistryFormSubmissionService],
    }).compile();

    service = module.get<MinistryFormSubmissionService>(MinistryFormSubmissionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
