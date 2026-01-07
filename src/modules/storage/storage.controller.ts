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
  Res,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express'; 
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { UserRole } from '../../entities/user.entity';

@Controller('file')
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload/:submissionId')
  @UseInterceptors(FileInterceptor('file'))
  @UseGuards(RolesGuard)
  @Roles(UserRole.NODAL_OFFICER, UserRole.STATE_APPROVER, UserRole.MINISTRY_APPROVER)
  async uploadFile(
    @Param('submissionId') submissionId: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ) {

    if (req.user.role !== UserRole.NODAL_OFFICER &&
       req.user.role !== UserRole.STATE_APPROVER &&
       req.user.role !== UserRole.MINISTRY_APPROVER) {
        console.log("Entering the condition");
      throw new BadRequestException('Only Nodal Officers, State Approvers, and Ministry Approvers can upload files');
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

  @Get("download/:filePath(*)")
async downloadFile(
  @Param("filePath") filePath: string,
  @Res() res: Response,  // ✅ Now properly typed with Response from express
): Promise<void> {
  try {
    // Decode the file path
    const decodedPath = decodeURIComponent(filePath);

    // Get file stream from storage
    const { stream, contentType, contentLength, fileName } =
      await this.storageService.getFileStream(decodedPath);

    // Extract original filename (remove UUID prefix if present)
    // Format: uuid_originalname.ext -> originalname.ext
    let downloadFileName = fileName || "download";
    if (downloadFileName.includes("_")) {
      const parts = downloadFileName.split("_");
      if (parts.length > 1) {
        // Check if first part looks like UUID (32 chars with hyphens, or 36 chars)
        const potentialUuid = parts[0];
        if (potentialUuid.length >= 32) {
          // Remove UUID prefix
          downloadFileName = parts.slice(1).join("_");
        }
      }
    }

    // Set headers for file download
    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${downloadFileName}"`
    );

    if (contentLength) {
      res.setHeader("Content-Length", contentLength.toString());
    }

    // Enable CORS if needed (adjust origin as necessary)
    res.setHeader("Access-Control-Allow-Origin", "*"); // Or use your specific origin
    res.setHeader("Access-Control-Allow-Credentials", "true");

    // Stream the file to the response
    stream.pipe(res);
  } catch (error) {
    const message =
      error && (error as any).message
        ? (error as any).message
        : String(error);

    // ✅ Better error handling - use NotFoundException for missing files
    if (message.includes("NoSuchKey") || message.includes("not found")) {
      throw new NotFoundException(`File not found: ${filePath}`);
    }

    throw new BadRequestException(`Failed to download file: ${message}`);
  }
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
