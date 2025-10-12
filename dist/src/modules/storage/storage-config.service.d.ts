import { ConfigService } from '@nestjs/config';
export interface StorageConfig {
    storageType: 'local' | 's3';
    awsAccessKeyId?: string;
    awsSecretAccessKey?: string;
    awsRegion?: string;
    s3BucketName?: string;
    storagePathLocal?: string;
}
export declare class StorageConfigService {
    private configService;
    constructor(configService: ConfigService);
    getStorageConfig(): StorageConfig;
    isS3Enabled(): boolean;
    validateConfig(): void;
}
