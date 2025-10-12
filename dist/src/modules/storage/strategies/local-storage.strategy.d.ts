import { ConfigService } from '@nestjs/config';
import { IStorageStrategy, UploadedFile, StoredFile } from '../interfaces/storage.interface';
export declare class LocalStorageStrategy implements IStorageStrategy {
    private configService;
    private readonly logger;
    private readonly storagePath;
    constructor(configService: ConfigService);
    private ensureStorageDirectory;
    uploadFile(file: UploadedFile, subFolder?: string): Promise<StoredFile>;
    deleteFile(filePath: string): Promise<boolean>;
    getSignedUrl(filePath: string): Promise<string>;
    deleteFolder(folderPath: string): Promise<boolean>;
}
