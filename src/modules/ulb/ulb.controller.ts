import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express'; 
import { CreateUlbDto } from './dto/create-ulb.dto';
import { UpdateUlbDto } from './dto/update-ulb.dto';
import { UlbStatus } from '../../entities/ulb-master.entity';
import { UlbService } from './ulb.service';

@Controller('ulb')
export class UlbController {
  constructor(private readonly ulbService: UlbService) {}

  @Get()
  async findAll(
    @Query('status') status?: string,
    @Query('state_name') stateName?: string,
    @Query('city_name') cityName?: string,
    @Query('ulb_name') ulbName?: string,
  ) {
    if (stateName) {
      return await this.ulbService.findByStateName(stateName);
    }
    if (cityName) {
      return await this.ulbService.findByCityName(cityName);
    }
    if (ulbName) {
      return await this.ulbService.findByUlbName(ulbName);
    }
    if (status !== undefined) {
      const statusEnum =
        status === '0' ? UlbStatus.INACTIVE : UlbStatus.ACTIVE;
      return await this.ulbService.findByStatus(statusEnum);
    }
    return await this.ulbService.findAll();
  }

  @Post('upload-excel')
  @UseInterceptors(FileInterceptor('file'))
  async uploadExcel(@UploadedFile() file: Express.Multer.File) {
    return await this.ulbService.uploadExcelAndCreateUlbs(file);
  }

  @Post()
  async create(@Body() createUlbDto: CreateUlbDto) {
    return await this.ulbService.create(createUlbDto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw new BadRequestException('Invalid UUID format');
    }
    return await this.ulbService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUlbDto: UpdateUlbDto,
  ) {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw new BadRequestException('Invalid UUID format');
    }
    return await this.ulbService.update(id, updateUlbDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw new BadRequestException('Invalid UUID format');
    }
    await this.ulbService.remove(id);
    return { message: 'ULB deleted successfully' };
  }
}