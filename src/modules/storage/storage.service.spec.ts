import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { StorageService } from './storage.service';
import { StorageConfigService } from './storage-config.service';
import { LocalStorageStrategy } from './strategies/local-storage.strategy';
import { S3StorageStrategy } from './strategies/s3-storage.strategy';

describe('StorageService', () => {
  let service: StorageService;
  let storageConfigService: StorageConfigService;
  let localStorageStrategy: LocalStorageStrategy;
  let s3StorageStrategy: S3StorageStrategy;

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
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: StorageConfigService,
          useValue: mockStorageConfigService,
        },
        {
          provide: LocalStorageStrategy,
          useValue: mockLocalStorageStrategy,
        },
        {
          provide: S3StorageStrategy,
          useValue: mockS3StorageStrategy,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
    storageConfigService = module.get<StorageConfigService>(StorageConfigService);
    localStorageStrategy = module.get<LocalStorageStrategy>(LocalStorageStrategy);
    s3StorageStrategy = module.get<S3StorageStrategy>(S3StorageStrategy);
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
    } as Express.Multer.File;

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
      mockStorageConfigService.validateConfig.mockImplementation(() => {});
    });

    it('should upload file successfully with local storage', async () => {
      mockLocalStorageStrategy.uploadFile.mockResolvedValue(mockUploadResult);

      const result = await service.uploadFile(mockFile, 'submission-id');

      expect(result).toEqual(mockUploadResult);
      expect(mockLocalStorageStrategy.uploadFile).toHaveBeenCalledWith(
        mockFile,
        'submissions/submission-id',
        expect.any(String),
      );
    });

    it('should upload file successfully with S3 storage', async () => {
      mockStorageConfigService.getStorageConfig.mockReturnValue({
        storageType: 's3',
      });
      mockS3StorageStrategy.uploadFile.mockResolvedValue(mockUploadResult);

      const result = await service.uploadFile(mockFile, 'submission-id');

      expect(result).toEqual(mockUploadResult);
      expect(mockS3StorageStrategy.uploadFile).toHaveBeenCalledWith(
        mockFile,
        'submissions/submission-id',
        expect.any(String),
      );
    });

    it('should throw BadRequestException for no file', async () => {
      await expect(service.uploadFile(null, 'submission-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for file size exceeding limit', async () => {
      const largeFile = {
        ...mockFile,
        size: 11 * 1024 * 1024, // 11MB
      };

      await expect(service.uploadFile(largeFile, 'submission-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for unsupported file type', async () => {
      const unsupportedFile = {
        ...mockFile,
        mimetype: 'application/unsupported',
      };

      await expect(service.uploadFile(unsupportedFile, 'submission-id')).rejects.toThrow(
        BadRequestException,
      );
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
    ] as Express.Multer.File[];

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
      mockStorageConfigService.validateConfig.mockImplementation(() => {});
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
      await expect(service.uploadMultipleFiles([], 'submission-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for too many files', async () => {
      const manyFiles = Array(11).fill(mockFiles[0]);

      await expect(service.uploadMultipleFiles(manyFiles, 'submission-id')).rejects.toThrow(
        BadRequestException,
      );
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

      await expect(service.getFileUrl('test-file-path')).rejects.toThrow(BadRequestException);
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

      // Should not throw error even if some deletions fail
      await expect(
        service.deleteSubmissionFiles('submission-id', filePaths),
      ).resolves.not.toThrow();
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
