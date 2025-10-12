import { ConfigService } from '@nestjs/config';
import { IStorageStrategy, UploadedFile, StoredFile } from '../interfaces/storage.interface';
export declare class S3StorageStrategy implements IStorageStrategy {
    private configService;
    private readonly logger;
    private readonly s3Client;
    private readonly bucketName;
    constructor(configService: ConfigService);
    uploadFile(file: UploadedFile, subFolder?: string): Promise<StoredFile>;
    deleteFile(filePath: string): Promise<boolean>;
    getSignedUrl(filePath: string): Promise<string>;
    deleteFolder(folderPath: string): Promise<boolean>;
    private getFileExtension;
}
