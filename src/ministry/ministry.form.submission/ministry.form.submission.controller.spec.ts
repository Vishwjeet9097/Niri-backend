import { Test, TestingModule } from '@nestjs/testing';
import { MinistryFormSubmissionController } from './ministry.form.submission.controller';
import { MinistryFormSubmissionService } from './ministry.form.submission.service';

describe('MinistryFormSubmissionController', () => {
  let controller: MinistryFormSubmissionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MinistryFormSubmissionController],
      providers: [MinistryFormSubmissionService],
    }).compile();

    controller = module.get<MinistryFormSubmissionController>(MinistryFormSubmissionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
