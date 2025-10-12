import { StorageConfigService } from './storage-config.service';
import { LocalStorageStrategy } from './strategies/local-storage.strategy';
import { S3StorageStrategy } from './strategies/s3-storage.strategy';
import { StoredFile } from './interfaces/storage.interface';
export declare class StorageService {
    private storageConfigService;
    private localStorageStrategy;
    private s3StorageStrategy;
    private readonly logger;
    private readonly storageStrategy;
    constructor(storageConfigService: StorageConfigService, localStorageStrategy: LocalStorageStrategy, s3StorageStrategy: S3StorageStrategy);
    private getStorageStrategy;
    uploadFile(file: Express.Multer.File, submissionId: string, fileType?: string): Promise<StoredFile>;
    uploadMultipleFiles(files: Express.Multer.File[], submissionId: string): Promise<StoredFile[]>;
    deleteFile(filePath: string): Promise<boolean>;
    getFileUrl(filePath: string): Promise<string>;
    deleteSubmissionFiles(submissionId: string, filePaths: string[]): Promise<void>;
    getStorageType(): string;
}
