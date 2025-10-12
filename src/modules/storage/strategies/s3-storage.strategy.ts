import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { IStorageStrategy, UploadedFile, StoredFile } from '../interfaces/storage.interface';

@Injectable()
export class S3StorageStrategy implements IStorageStrategy {
  private readonly logger = new Logger(S3StorageStrategy.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(private configService: ConfigService) {
    this.bucketName = this.configService.get('S3_BUCKET_NAME');

    this.s3Client = new S3Client({
      region: this.configService.get('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      },
    });

    this.logger.log(`S3 Storage Strategy initialized for bucket: ${this.bucketName}`);
  }

  async uploadFile(file: UploadedFile, subFolder?: string): Promise<StoredFile> {
    try {
      const fileExtension = this.getFileExtension(file.originalname);
      const uniqueFileName = `${uuidv4()}${fileExtension}`;
      const s3Key = subFolder ? `${subFolder}/${uniqueFileName}` : uniqueFileName;

      const uploadCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentLength: file.size,
        Metadata: {
          originalName: file.originalname,
          uploadedAt: new Date().toISOString(),
        },
      });

      await this.s3Client.send(uploadCommand);

      const fileUrl = `https://${this.bucketName}.s3.${this.configService.get('AWS_REGION')}.amazonaws.com/${s3Key}`;

      this.logger.log(`File uploaded to S3 successfully: ${s3Key}`);

      return {
        fileName: uniqueFileName,
        originalName: file.originalname,
        filePath: s3Key,
        fileUrl: await this.getSignedUrl(s3Key),
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`S3 upload failed: ${error.message}`);
      throw new Error(`Failed to upload file to S3: ${error.message}`);
    }
  }

  async deleteFile(filePath: string): Promise<boolean> {
    try {
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: filePath,
      });

      await this.s3Client.send(deleteCommand);

      this.logger.log(`File deleted from S3 successfully: ${filePath}`);

      return true;
    } catch (error) {
      this.logger.error(`S3 deletion failed: ${error.message}`);
      return false;
    }
  }

  async getSignedUrl(filePath: string): Promise<string> {
    try {
      const getObjectCommand = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: filePath,
      });

      // Generate a signed URL valid for 1 hour
      const signedUrl = await getSignedUrl(this.s3Client, getObjectCommand, { expiresIn: 3600 });
      return signedUrl;
    } catch (error) {
      this.logger.error(`Failed to generate signed URL: ${error.message}`);
      throw new Error(`Failed to generate file URL: ${error.message}`);
    }
  }

  async deleteFolder(folderPath: string): Promise<boolean> {
    try {
      // S3 doesn't have folders, but we can delete all objects with the prefix
      // This is a simplified implementation
      this.logger.log(`S3 folder deletion requested for: ${folderPath}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete S3 folder: ${error.message}`);
      return false;
    }
  }

  private getFileExtension(originalName: string): string {
    const lastDotIndex = originalName.lastIndexOf('.');
    return lastDotIndex !== -1 ? originalName.substring(lastDotIndex) : '';
  }
}
