import { UploadedFile, StoredFile, IStorageStrategy } from '../interfaces/storage.interface';
export declare class S3StorageStrategy implements IStorageStrategy {
    private readonly logger;
    private s3;
    private bucket;
    private defaultExpirySec;
    constructor();
    private makeKey;
    uploadFile(file: UploadedFile | Express.Multer.File, subFolder?: string): Promise<StoredFile>;
    deleteFile(filePath: string): Promise<boolean>;
    getSignedUrl(filePath: string): Promise<string>;
    deleteFolder(folderPath: string): Promise<boolean>;
}
