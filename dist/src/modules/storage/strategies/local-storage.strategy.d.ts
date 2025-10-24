import { UploadedFile, StoredFile, IStorageStrategy } from '../interfaces/storage.interface';
export declare class LocalStorageStrategy implements IStorageStrategy {
    private readonly logger;
    private basePath;
    constructor();
    private makePath;
    uploadFile(file: UploadedFile | Express.Multer.File, subFolder?: string): Promise<StoredFile>;
    deleteFile(filePath: string): Promise<boolean>;
    getSignedUrl(filePath: string): Promise<string>;
    deleteFolder(folderPath: string): Promise<boolean>;
}
