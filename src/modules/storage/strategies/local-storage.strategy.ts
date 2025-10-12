import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { IStorageStrategy, UploadedFile, StoredFile } from '../interfaces/storage.interface';

@Injectable()
export class LocalStorageStrategy implements IStorageStrategy {
  private readonly logger = new Logger(LocalStorageStrategy.name);
  private readonly storagePath: string;

  constructor(private configService: ConfigService) {
    this.storagePath = this.configService.get('STORAGE_PATH_LOCAL', './uploads');
    this.ensureStorageDirectory();
  }

  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.storagePath, { recursive: true });
      this.logger.log(`Storage directory ensured: ${this.storagePath}`);
    } catch (error) {
      this.logger.error(`Failed to create storage directory: ${error.message}`);
      throw error;
    }
  }

  async uploadFile(file: UploadedFile, subFolder?: string): Promise<StoredFile> {
    try {
      const fullFolderPath = subFolder ? path.join(this.storagePath, subFolder) : this.storagePath;
      await fs.mkdir(fullFolderPath, { recursive: true });

      const fileExtension = path.extname(file.originalname);
      const uniqueFileName = `${uuidv4()}${fileExtension}`;
      const fullFilePath = path.join(fullFolderPath, uniqueFileName);

      await fs.writeFile(fullFilePath, file.buffer);

      const relativePath = subFolder ? path.join(subFolder, uniqueFileName) : uniqueFileName;
      const fileUrl = `/uploads/${relativePath}`;

      this.logger.log(`File uploaded successfully: ${fullFilePath}`);

      return {
        fileName: uniqueFileName,
        originalName: file.originalname,
        filePath: relativePath,
        fileUrl,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`File upload failed: ${error.message}`);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  async deleteFile(filePath: string): Promise<boolean> {
    try {
      const fullFilePath = path.join(this.storagePath, filePath);
      await fs.unlink(fullFilePath);

      this.logger.log(`File deleted successfully: ${fullFilePath}`);

      return true;
    } catch (error) {
      this.logger.error(`File deletion failed: ${error.message}`);
      return false;
    }
  }

  async getSignedUrl(filePath: string): Promise<string> {
    return `/uploads/${filePath}`;
  }

  async deleteFolder(folderPath: string): Promise<boolean> {
    try {
      const fullFolderPath = path.join(this.storagePath, folderPath);
      await fs.rm(fullFolderPath, { recursive: true, force: true });
      this.logger.log(`Folder deleted successfully: ${fullFolderPath}`);
      return true;
    } catch (error) {
      this.logger.error(`Folder deletion failed: ${error.message}`);
      return false;
    }
  }
}
