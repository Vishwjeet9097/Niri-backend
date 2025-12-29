import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MinistryFormCreateService } from './ministry.form.create.service';
import { CreateIndicatorDto } from './dto/create-indicator.dto';
import { CreateSubsectionDto } from './dto/create-subsection.dto';
import { CreateInputFieldDto } from './dto/create-input-field.dto';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../modules/auth/guards/roles.guard';
import { UserRole } from '../../entities/user.entity';

@Controller('ministry/form/create')
@UseGuards(JwtAuthGuard)
export class MinistryFormCreateController {
  constructor(
    private readonly ministryFormCreateService: MinistryFormCreateService,
  ) {}

  @Post('indicator')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER,
  )
  @HttpCode(HttpStatus.CREATED)
  async createIndicator(@Body() createIndicatorDto: CreateIndicatorDto) {
    return this.ministryFormCreateService.createIndicator(createIndicatorDto);
  }

  @Get('indicators')
  async getAllActiveIndicators() {
    return this.ministryFormCreateService.getAllActiveIndicators();
  }

  @Post('subsection')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER,
  )
  @HttpCode(HttpStatus.CREATED)
  async createSubsection(@Body() createSubsectionDto: CreateSubsectionDto) {
    return this.ministryFormCreateService.createSubsection(createSubsectionDto);
  }

  @Get('subsections')
  async getAllActiveSubsections() {
    return this.ministryFormCreateService.getAllActiveSubsections();
  }

  @Post('input-field')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER,
  )
  @HttpCode(HttpStatus.CREATED)
  async createInputField(@Body() createInputFieldDto: CreateInputFieldDto) {
    return this.ministryFormCreateService.createInputField(createInputFieldDto);
  }

  @Get('input-fields')
  async getAllInputFields() {
    return this.ministryFormCreateService.getAllInputFields();
  }

  @Post('indicators/upload-excel')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER,
  )
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  async uploadExcelIndicators(@UploadedFile() file: Express.Multer.File) {
    return this.ministryFormCreateService.uploadExcelAndCreateIndicators(file);
  }
}
