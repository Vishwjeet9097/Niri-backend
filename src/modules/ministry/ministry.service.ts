import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ministry } from '../../entities/ministry.entity';
import { Roles } from '../auth/guards/roles.guard';
import { UserRole } from '@/entities/user.entity';

@Injectable()
export class MinistryService {
  constructor(
    @InjectRepository(Ministry)
    private readonly ministryRepository: Repository<Ministry>,
  ) {}

 @Roles(UserRole.MINISTRY_APPROVER,UserRole.ADMIN)  
  async findAll(): Promise<Ministry[]> {
    return this.ministryRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  @Roles(UserRole.MINISTRY_APPROVER,UserRole.ADMIN)  
  async findOne(id: string): Promise<Ministry> {
    const ministry = await this.ministryRepository.findOne({ where: { id, isActive: true } });
    if (!ministry) {
      throw new NotFoundException('Ministry not found');
    }
    return ministry;
  }
}
