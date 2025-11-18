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
  @Roles(UserRole.NODAL_OFFICER, UserRole.STATE_APPROVER)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Param('submissionId') submissionId: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {

    if (req.user.role !== UserRole.NODAL_OFFICER &&
       req.user.role !== UserRole.STATE_APPROVER) {
        console.log("Entering the condition");
      throw new BadRequestException('Only Nodal Officers and State Approvers can upload files');
    }

    // Validate file was properly uploaded
    if (!file || !file.originalname) {
      throw new BadRequestException('No file provided. Please upload a file using multipart/form-data with field name "file"');
    }

    const result = await this.storageService.uploadFile(file, submissionId);

    return {
      message: 'File uploaded successfully',
      data: {
        filePath: result.filePath, // ✅ Only return filePath (not signed URL)
        fileName: result.fileName,
        mimeType: result.mimeType,
        size: result.fileSize,
      },
    };
  }

  @Post('upload-multiple/:submissionId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.NODAL_OFFICER)
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadMultipleFiles(
    @Param('submissionId') submissionId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req,
  ) {
    if (req.user.role !== UserRole.NODAL_OFFICER) {
      throw new BadRequestException('Only Nodal Officers can upload files');
    }

    const results = await this.storageService.uploadMultipleFiles(files, submissionId);

    return {
      message: 'Files uploaded successfully',
      count: results.length,
      data: results.map((r) => ({
        filePath: r.filePath,
        fileName: r.fileName,
        mimeType: r.mimeType,
        size: r.fileSize,
      })),
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
    const decodedPath = decodeURIComponent(filePath); // ✅ handle encoded slashes
    const result = await this.storageService.deleteFile(decodedPath);

    return {
      message: result ? 'File deleted successfully' : 'File deletion failed',
      success: result,
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
    const decodedPath = decodeURIComponent(filePath); // ✅ decode S3 path
    const url = await this.storageService.getFileUrl(decodedPath);

    return {
      filePath: decodedPath,
      signedUrl: url,
      expiresIn: '1 hour',
    };
  }

  @Get('storage-info')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MOSPI_REVIEWER, UserRole.MOSPI_APPROVER)
  async getStorageInfo() {
    const type = this.storageService.getStorageType();
    return {
      storageType: type,
      message: `Files are stored using ${type.toUpperCase()} strategy.`,
    };
  }
}
