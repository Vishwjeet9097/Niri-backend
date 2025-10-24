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
    fields?: Record<string, string>;
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
    confirmUpload(key: string): Promise<UploadMetadata>;
    getDownloadUrl(key: string, expiresIn?: number): Promise<string>;
    delete(key: string): Promise<void>;
}
export declare class StorageConfigService {
    private configService;
    constructor(configService: ConfigService);
    getStorageConfig(): StorageConfig;
    isS3Enabled(): boolean;
    validateConfig(): void;
}
