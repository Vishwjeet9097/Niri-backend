import { Test, TestingModule } from '@nestjs/testing';
import { MinistryFormRetrieveController } from './ministry.form.retrieve.controller';
import { MinistryFormRetrieveService } from './ministry.form.retrieve.service';

describe('MinistryFormRetrieveController', () => {
  let controller: MinistryFormRetrieveController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MinistryFormRetrieveController],
      providers: [MinistryFormRetrieveService],
    }).compile();

    controller = module.get<MinistryFormRetrieveController>(MinistryFormRetrieveController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
