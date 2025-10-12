import {
  Controller,
  Post,
  Delete,
  Param,
  Get,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { UserRole } from '../../entities/user.entity';

@Controller('file')
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload/:submissionId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.NODAL_OFFICER)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Param('submissionId') submissionId: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {
    // Verify that the user can upload files for this submission
    if (req.user.role !== UserRole.NODAL_OFFICER) {
      throw new BadRequestException('Only Nodal Officers can upload files');
    }

    const result = await this.storageService.uploadFile(file, submissionId);

    return {
      message: 'File uploaded successfully',
      data: result,
    };
  }

  @Post('upload-multiple/:submissionId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.NODAL_OFFICER)
  @UseInterceptors(FilesInterceptor('files', 10)) // Maximum 10 files
  async uploadMultipleFiles(
    @Param('submissionId') submissionId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req,
  ) {
    // Verify that the user can upload files for this submission
    if (req.user.role !== UserRole.NODAL_OFFICER) {
      throw new BadRequestException('Only Nodal Officers can upload files');
    }

    const results = await this.storageService.uploadMultipleFiles(files, submissionId);

    return {
      message: 'Files uploaded successfully',
      data: results,
      count: results.length,
    };
  }

  @Delete(':filePath')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.NODAL_OFFICER,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER,
  )
  async deleteFile(@Param('filePath') filePath: string) {
    const result = await this.storageService.deleteFile(filePath);

    return {
      message: result ? 'File deleted successfully' : 'File deletion failed',
      success: result,
      details: result ? 'File removed from storage' : 'Failed to remove file',
    };
  }

  @Get('url/:filePath')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.NODAL_OFFICER,
    UserRole.STATE_APPROVER,
    UserRole.MOSPI_REVIEWER,
    UserRole.MOSPI_APPROVER,
  )
  async getFileUrl(@Param('filePath') filePath: string) {
    const url = await this.storageService.getFileUrl(filePath);

    return {
      filePath,
      url,
      expiresIn: this.storageService.getStorageType() === 's3' ? '1 hour' : 'permanent',
    };
  }

  @Get('storage-info')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MOSPI_REVIEWER, UserRole.MOSPI_APPROVER)
  async getStorageInfo() {
    return {
      storageType: this.storageService.getStorageType(),
      message: `Files are stored using ${this.storageService.getStorageType()} strategy`,
    };
  }
}
