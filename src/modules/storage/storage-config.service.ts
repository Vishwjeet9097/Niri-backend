import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface StorageConfig {
  storageType: 'local' | 's3';
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsRegion?: string;
  s3BucketName?: string;
  storagePathLocal?: string;
}
export interface PresignResult {
  url: string;
  fields?: Record<string, string>; // for POST style if needed
  key: string;
  expiresIn?: number;
}

export interface UploadMetadata {
  key: string;
  filename?: string;
  contentType?: string;
  size?: number;
  etag?: string;
}

export interface StorageStrategy {
  providerName(): string;
  getPresignedUpload(key: string, contentType?: string, expiresIn?: number): Promise<PresignResult>;
  confirmUpload(key: string): Promise<UploadMetadata>; // e.g. HEAD object to get size/type/etag
  getDownloadUrl(key: string, expiresIn?: number): Promise<string>;
  delete(key: string): Promise<void>;
}

@Injectable()
export class StorageConfigService {
  constructor(private configService: ConfigService) {}

  getStorageConfig(): StorageConfig {
    return {
      storageType: this.configService.get('STORAGE_TYPE', 'local') as 'local' | 's3',
      awsAccessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
      awsSecretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      awsRegion: this.configService.get('S3_REGION'),
      s3BucketName: this.configService.get('S3_BUCKET_NAME'),
      storagePathLocal: this.configService.get('STORAGE_PATH_LOCAL', './uploads'),
    };
  }

  isS3Enabled(): boolean {
    return this.getStorageConfig().storageType === 's3';
  }

  validateConfig(): void {
    const config = this.getStorageConfig();
    
    if (config.storageType === 's3') {
      if (!config.awsAccessKeyId || !config.awsSecretAccessKey || !config.awsRegion || !config.s3BucketName) {
        throw new Error('S3 configuration is incomplete. Please provide AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_REGION, and S3_BUCKET_NAME');
      }
    }
  }
}
