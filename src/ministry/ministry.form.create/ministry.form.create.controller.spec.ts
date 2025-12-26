import { Test, TestingModule } from '@nestjs/testing';
import { MinistryFormCreateController } from './ministry.form.create.controller';
import { MinistryFormCreateService } from './ministry.form.create.service';

describe('MinistryFormCreateController', () => {
  let controller: MinistryFormCreateController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MinistryFormCreateController],
      providers: [MinistryFormCreateService],
    }).compile();

    controller = module.get<MinistryFormCreateController>(MinistryFormCreateController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
