"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const config_1 = require("@nestjs/config");
const common_1 = require("@nestjs/common");
const storage_service_1 = require("./storage.service");
const storage_config_service_1 = require("./storage-config.service");
const local_storage_strategy_1 = require("./strategies/local-storage.strategy");
const s3_storage_strategy_1 = require("./strategies/s3-storage.strategy");
describe('StorageService', () => {
    let service;
    let storageConfigService;
    let localStorageStrategy;
    let s3StorageStrategy;
    const mockConfigService = {
        get: jest.fn(),
    };
    const mockLocalStorageStrategy = {
        uploadFile: jest.fn(),
        deleteFile: jest.fn(),
        getFileUrl: jest.fn(),
    };
    const mockS3StorageStrategy = {
        uploadFile: jest.fn(),
        deleteFile: jest.fn(),
        getFileUrl: jest.fn(),
    };
    const mockStorageConfigService = {
        getStorageConfig: jest.fn(),
        isS3Enabled: jest.fn(),
        validateConfig: jest.fn(),
    };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                storage_service_1.StorageService,
                {
                    provide: storage_config_service_1.StorageConfigService,
                    useValue: mockStorageConfigService,
                },
                {
                    provide: local_storage_strategy_1.LocalStorageStrategy,
                    useValue: mockLocalStorageStrategy,
                },
                {
                    provide: s3_storage_strategy_1.S3StorageStrategy,
                    useValue: mockS3StorageStrategy,
                },
                {
                    provide: config_1.ConfigService,
                    useValue: mockConfigService,
                },
            ],
        }).compile();
        service = module.get(storage_service_1.StorageService);
        storageConfigService = module.get(storage_config_service_1.StorageConfigService);
        localStorageStrategy = module.get(local_storage_strategy_1.LocalStorageStrategy);
        s3StorageStrategy = module.get(s3_storage_strategy_1.S3StorageStrategy);
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    describe('uploadFile', () => {
        const mockFile = {
            originalname: 'test.pdf',
            mimetype: 'application/pdf',
            size: 1024,
            buffer: Buffer.from('test content'),
        };
        const mockUploadResult = {
            fileName: 'uuid-generated-name.pdf',
            originalName: 'test.pdf',
            filePath: 'submissions/submission-id/uuid-generated-name.pdf',
            fileUrl: '/uploads/submissions/submission-id/uuid-generated-name.pdf',
            fileSize: 1024,
            mimeType: 'application/pdf',
            uploadedAt: new Date(),
        };
        beforeEach(() => {
            mockStorageConfigService.getStorageConfig.mockReturnValue({
                storageType: 'local',
            });
            mockStorageConfigService.validateConfig.mockImplementation(() => { });
        });
        it('should upload file successfully with local storage', async () => {
            mockLocalStorageStrategy.uploadFile.mockResolvedValue(mockUploadResult);
            const result = await service.uploadFile(mockFile, 'submission-id');
            expect(result).toEqual(mockUploadResult);
            expect(mockLocalStorageStrategy.uploadFile).toHaveBeenCalledWith(mockFile, 'submissions/submission-id', expect.any(String));
        });
        it('should upload file successfully with S3 storage', async () => {
            mockStorageConfigService.getStorageConfig.mockReturnValue({
                storageType: 's3',
            });
            mockS3StorageStrategy.uploadFile.mockResolvedValue(mockUploadResult);
            const result = await service.uploadFile(mockFile, 'submission-id');
            expect(result).toEqual(mockUploadResult);
            expect(mockS3StorageStrategy.uploadFile).toHaveBeenCalledWith(mockFile, 'submissions/submission-id', expect.any(String));
        });
        it('should throw BadRequestException for no file', async () => {
            await expect(service.uploadFile(null, 'submission-id')).rejects.toThrow(common_1.BadRequestException);
        });
        it('should throw BadRequestException for file size exceeding limit', async () => {
            const largeFile = {
                ...mockFile,
                size: 11 * 1024 * 1024,
            };
            await expect(service.uploadFile(largeFile, 'submission-id')).rejects.toThrow(common_1.BadRequestException);
        });
        it('should throw BadRequestException for unsupported file type', async () => {
            const unsupportedFile = {
                ...mockFile,
                mimetype: 'application/unsupported',
            };
            await expect(service.uploadFile(unsupportedFile, 'submission-id')).rejects.toThrow(common_1.BadRequestException);
        });
    });
    describe('uploadMultipleFiles', () => {
        const mockFiles = [
            {
                originalname: 'test1.pdf',
                mimetype: 'application/pdf',
                size: 1024,
                buffer: Buffer.from('test content 1'),
            },
            {
                originalname: 'test2.pdf',
                mimetype: 'application/pdf',
                size: 1024,
                buffer: Buffer.from('test content 2'),
            },
        ];
        const mockUploadResults = mockFiles.map((file, index) => ({
            fileName: `uuid-generated-name-${index}.pdf`,
            originalName: file.originalname,
            filePath: `submissions/submission-id/uuid-generated-name-${index}.pdf`,
            fileUrl: `/uploads/submissions/submission-id/uuid-generated-name-${index}.pdf`,
            fileSize: file.size,
            mimeType: file.mimetype,
            uploadedAt: new Date(),
        }));
        beforeEach(() => {
            mockStorageConfigService.getStorageConfig.mockReturnValue({
                storageType: 'local',
            });
            mockStorageConfigService.validateConfig.mockImplementation(() => { });
        });
        it('should upload multiple files successfully', async () => {
            mockLocalStorageStrategy.uploadFile
                .mockResolvedValueOnce(mockUploadResults[0])
                .mockResolvedValueOnce(mockUploadResults[1]);
            const result = await service.uploadMultipleFiles(mockFiles, 'submission-id');
            expect(result).toEqual(mockUploadResults);
            expect(mockLocalStorageStrategy.uploadFile).toHaveBeenCalledTimes(2);
        });
        it('should throw BadRequestException for no files', async () => {
            await expect(service.uploadMultipleFiles([], 'submission-id')).rejects.toThrow(common_1.BadRequestException);
        });
        it('should throw BadRequestException for too many files', async () => {
            const manyFiles = Array(11).fill(mockFiles[0]);
            await expect(service.uploadMultipleFiles(manyFiles, 'submission-id')).rejects.toThrow(common_1.BadRequestException);
        });
    });
    describe('deleteFile', () => {
        beforeEach(() => {
            mockStorageConfigService.getStorageConfig.mockReturnValue({
                storageType: 'local',
            });
        });
        it('should delete file successfully', async () => {
            const mockDeleteResult = {
                success: true,
                message: 'File deleted successfully',
            };
            mockLocalStorageStrategy.deleteFile.mockResolvedValue(mockDeleteResult);
            const result = await service.deleteFile('test-file-path');
            expect(result).toEqual(mockDeleteResult);
            expect(mockLocalStorageStrategy.deleteFile).toHaveBeenCalledWith('test-file-path');
        });
        it('should handle delete failure gracefully', async () => {
            const mockDeleteResult = {
                success: false,
                message: 'File deletion failed',
            };
            mockLocalStorageStrategy.deleteFile.mockResolvedValue(mockDeleteResult);
            const result = await service.deleteFile('test-file-path');
            expect(result).toEqual(mockDeleteResult);
        });
    });
    describe('getFileUrl', () => {
        beforeEach(() => {
            mockStorageConfigService.getStorageConfig.mockReturnValue({
                storageType: 'local',
            });
        });
        it('should get file URL successfully', async () => {
            const mockUrl = '/uploads/test-file-path';
            mockLocalStorageStrategy.getFileUrl.mockResolvedValue(mockUrl);
            const result = await service.getFileUrl('test-file-path');
            expect(result).toBe(mockUrl);
            expect(mockLocalStorageStrategy.getFileUrl).toHaveBeenCalledWith('test-file-path');
        });
        it('should throw BadRequestException for URL generation failure', async () => {
            mockLocalStorageStrategy.getFileUrl.mockRejectedValue(new Error('URL generation failed'));
            await expect(service.getFileUrl('test-file-path')).rejects.toThrow(common_1.BadRequestException);
        });
    });
    describe('deleteSubmissionFiles', () => {
        beforeEach(() => {
            mockStorageConfigService.getStorageConfig.mockReturnValue({
                storageType: 'local',
            });
        });
        it('should delete multiple files successfully', async () => {
            const filePaths = ['file1.pdf', 'file2.pdf'];
            mockLocalStorageStrategy.deleteFile.mockResolvedValue({
                success: true,
                message: 'File deleted successfully',
            });
            await service.deleteSubmissionFiles('submission-id', filePaths);
            expect(mockLocalStorageStrategy.deleteFile).toHaveBeenCalledTimes(2);
            expect(mockLocalStorageStrategy.deleteFile).toHaveBeenCalledWith('file1.pdf');
            expect(mockLocalStorageStrategy.deleteFile).toHaveBeenCalledWith('file2.pdf');
        });
        it('should handle partial deletion failures gracefully', async () => {
            const filePaths = ['file1.pdf', 'file2.pdf'];
            mockLocalStorageStrategy.deleteFile
                .mockResolvedValueOnce({ success: true, message: 'Success' })
                .mockRejectedValueOnce(new Error('Deletion failed'));
            await expect(service.deleteSubmissionFiles('submission-id', filePaths)).resolves.not.toThrow();
        });
    });
    describe('getStorageType', () => {
        it('should return storage type', () => {
            mockStorageConfigService.getStorageConfig.mockReturnValue({
                storageType: 's3',
            });
            const result = service.getStorageType();
            expect(result).toBe('s3');
        });
    });
});
//# sourceMappingURL=storage.service.spec.js.map