import { StorageService } from './storage.service';
export declare class StorageController {
    private readonly storageService;
    constructor(storageService: StorageService);
    uploadFile(submissionId: string, file: Express.Multer.File, req: any): Promise<{
        message: string;
        data: import("./interfaces/storage.interface").StoredFile;
    }>;
    uploadMultipleFiles(submissionId: string, files: Express.Multer.File[], req: any): Promise<{
        message: string;
        data: import("./interfaces/storage.interface").StoredFile[];
        count: number;
    }>;
    deleteFile(filePath: string): Promise<{
        message: string;
        success: boolean;
        details: string;
    }>;
    getFileUrl(filePath: string): Promise<{
        filePath: string;
        url: string;
        expiresIn: string;
    }>;
    getStorageInfo(): Promise<{
        storageType: string;
        message: string;
    }>;
}
