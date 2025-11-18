import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { StorageConfigService } from "./storage-config.service";
import { LocalStorageStrategy } from "./strategies/local-storage.strategy";
import { S3StorageStrategy } from "./strategies/s3-storage.strategy";
import { IStorageStrategy, StoredFile } from "./interfaces/storage.interface";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly storageStrategy: IStorageStrategy;

  constructor(
    private storageConfigService: StorageConfigService,
    private localStorageStrategy: LocalStorageStrategy,
    private s3StorageStrategy: S3StorageStrategy
  ) {
    this.storageConfigService.validateConfig();
    this.storageStrategy = this.getStorageStrategy();
    this.logger.log(
      `Storage service initialized with strategy: ${this.storageConfigService.getStorageConfig().storageType}`
    );
  }

  /**
   * Uploads all files attached to a submission.
   * @param submissionId The submission ID.
   * @param attachedFiles Array of file objects (should match Express.Multer.File interface).
   */
  async uploadSubmissionFiles(
    submissionId: string,
    attachedFiles: Express.Multer.File[]
  ): Promise<StoredFile[]> {
    if (!attachedFiles || attachedFiles.length === 0) {
      throw new BadRequestException("No attached files to upload");
    }
    if (attachedFiles.length > 10) {
      throw new BadRequestException("Maximum 10 files allowed per submission");
    }

    const uploadPromises = attachedFiles.map((file) =>
      this.uploadFile(file, submissionId)
    );

    try {
      const results = await Promise.all(uploadPromises);
      this.logger.log(
        `All attached files uploaded for submission: ${submissionId}`
      );
      return results;
    } catch (error) {
      const msg =
        error && (error as any).message
          ? (error as any).message
          : String(error);
      this.logger.error(`Failed to upload attached files: ${msg}`);
      throw new BadRequestException(`Failed to upload attached files: ${msg}`);
    }
  }

  private getStorageStrategy(): IStorageStrategy {
    const config = this.storageConfigService.getStorageConfig();
    return config.storageType === "s3"
      ? this.s3StorageStrategy
      : this.localStorageStrategy;
  }

  async uploadFile(
    file: Express.Multer.File,
    submissionId: string,
    fileType?: string
  ): Promise<StoredFile> {
    if (!file) {
      throw new BadRequestException("No file provided");
    }

    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      throw new BadRequestException("File size exceeds 50MB limit");
    }

    // Validate file type
    const allowedMimeTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "image/jpeg",
      "image/png",
      "image/gif",
      "text/plain",
      "text/csv",
      "application/octet-stream",
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed`
      );
    }

    try {
      // Build a unique destination path so uploaded files don't collide
      const uniqueFileId = uuidv4();
      // sanitize original name a little (keep extension)
      const original = file.originalname || "file";
      const safeOriginal = original.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const destinationPath = `submissions/${submissionId}/${uniqueFileId}_${safeOriginal}`;

      const result = await this.storageStrategy.uploadFile(
        file,
        destinationPath
      );

      this.logger.log(
        `File uploaded successfully: ${result.fileName || destinationPath} for submission: ${submissionId}`
      );

      return result;
    } catch (error) {
      const msg =
        error && (error as any).message
          ? (error as any).message
          : String(error);
      this.logger.error(`File upload failed: ${msg}`);
      throw new BadRequestException(`File upload failed: ${msg}`);
    }
  }

  async uploadMultipleFiles(
    files: Express.Multer.File[],
    submissionId: string
  ): Promise<StoredFile[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException("No files provided");
    }

    if (files.length > 10) {
      throw new BadRequestException("Maximum 10 files allowed per upload");
    }

    const uploadPromises = files.map((file) =>
      this.uploadFile(file, submissionId)
    );

    try {
      const results = await Promise.all(uploadPromises);
      this.logger.log(
        `Multiple files uploaded successfully for submission: ${submissionId}`
      );
      return results;
    } catch (error) {
      const msg =
        error && (error as any).message
          ? (error as any).message
          : String(error);
      this.logger.error(`Multiple file upload failed: ${msg}`);
      throw new BadRequestException(`Multiple file upload failed: ${msg}`);
    }
  }

  async deleteFile(filePath: string): Promise<boolean> {
    try {
      const result = await this.storageStrategy.deleteFile(filePath);
      return result;
    } catch (error) {
      const msg =
        error && (error as any).message
          ? (error as any).message
          : String(error);
      this.logger.error(`File deletion failed: ${msg}`);
      return false;
    }
  }

  async getFileUrl(filePath: string): Promise<string> {
    try {
      return await this.storageStrategy.getSignedUrl(filePath);
    } catch (error) {
      const msg =
        error && (error as any).message
          ? (error as any).message
          : String(error);
      this.logger.error(`Failed to get file URL: ${msg}`);
      throw new BadRequestException(`Failed to get file URL: ${msg}`);
    }
  }

  async deleteSubmissionFiles(
    submissionId: string,
    filePaths: string[]
  ): Promise<void> {
    const deletePromises = filePaths.map((filePath) =>
      this.deleteFile(filePath)
    );

    try {
      await Promise.all(deletePromises);
      this.logger.log(`All files deleted for submission: ${submissionId}`);
    } catch (error) {
      const msg =
        error && (error as any).message
          ? (error as any).message
          : String(error);
      this.logger.error(`Failed to delete submission files: ${msg}`);
      // Don't throw error here as individual file deletions might succeed
    }
  }

  getStorageType(): string {
    return this.storageConfigService.getStorageConfig().storageType;
  }
}
