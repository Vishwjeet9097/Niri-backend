"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var StorageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = void 0;
const common_1 = require("@nestjs/common");
const storage_config_service_1 = require("./storage-config.service");
const local_storage_strategy_1 = require("./strategies/local-storage.strategy");
const s3_storage_strategy_1 = require("./strategies/s3-storage.strategy");
const uuid_1 = require("uuid");
let StorageService = StorageService_1 = class StorageService {
    constructor(storageConfigService, localStorageStrategy, s3StorageStrategy) {
        this.storageConfigService = storageConfigService;
        this.localStorageStrategy = localStorageStrategy;
        this.s3StorageStrategy = s3StorageStrategy;
        this.logger = new common_1.Logger(StorageService_1.name);
        this.storageConfigService.validateConfig();
        this.storageStrategy = this.getStorageStrategy();
        this.logger.log(`Storage service initialized with strategy: ${this.storageConfigService.getStorageConfig().storageType}`);
    }
    getStorageStrategy() {
        const config = this.storageConfigService.getStorageConfig();
        return config.storageType === 's3' ? this.s3StorageStrategy : this.localStorageStrategy;
    }
    async uploadFile(file, submissionId, fileType) {
        if (!file) {
            throw new common_1.BadRequestException('No file provided');
        }
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            throw new common_1.BadRequestException('File size exceeds 10MB limit');
        }
        const allowedMimeTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'image/jpeg',
            'image/png',
            'image/gif',
            'text/plain',
        ];
        if (!allowedMimeTypes.includes(file.mimetype)) {
            throw new common_1.BadRequestException(`File type ${file.mimetype} is not allowed`);
        }
        try {
            const folderPath = `submissions/${submissionId}`;
            const uniqueFileName = (0, uuid_1.v4)();
            const result = await this.storageStrategy.uploadFile(file, folderPath);
            this.logger.log(`File uploaded successfully: ${result.fileName} for submission: ${submissionId}`);
            return result;
        }
        catch (error) {
            this.logger.error(`File upload failed: ${error.message}`);
            throw new common_1.BadRequestException(`File upload failed: ${error.message}`);
        }
    }
    async uploadMultipleFiles(files, submissionId) {
        if (!files || files.length === 0) {
            throw new common_1.BadRequestException('No files provided');
        }
        if (files.length > 10) {
            throw new common_1.BadRequestException('Maximum 10 files allowed per upload');
        }
        const uploadPromises = files.map((file) => this.uploadFile(file, submissionId));
        try {
            const results = await Promise.all(uploadPromises);
            this.logger.log(`Multiple files uploaded successfully for submission: ${submissionId}`);
            return results;
        }
        catch (error) {
            this.logger.error(`Multiple file upload failed: ${error.message}`);
            throw new common_1.BadRequestException(`Multiple file upload failed: ${error.message}`);
        }
    }
    async deleteFile(filePath) {
        try {
            const result = await this.storageStrategy.deleteFile(filePath);
            return result;
        }
        catch (error) {
            this.logger.error(`File deletion failed: ${error.message}`);
            return false;
        }
    }
    async getFileUrl(filePath) {
        try {
            return await this.storageStrategy.getSignedUrl(filePath);
        }
        catch (error) {
            this.logger.error(`Failed to get file URL: ${error.message}`);
            throw new common_1.BadRequestException(`Failed to get file URL: ${error.message}`);
        }
    }
    async deleteSubmissionFiles(submissionId, filePaths) {
        const deletePromises = filePaths.map((filePath) => this.deleteFile(filePath));
        try {
            await Promise.all(deletePromises);
            this.logger.log(`All files deleted for submission: ${submissionId}`);
        }
        catch (error) {
            this.logger.error(`Failed to delete submission files: ${error.message}`);
        }
    }
    getStorageType() {
        return this.storageConfigService.getStorageConfig().storageType;
    }
};
exports.StorageService = StorageService;
exports.StorageService = StorageService = StorageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [storage_config_service_1.StorageConfigService,
        local_storage_strategy_1.LocalStorageStrategy,
        s3_storage_strategy_1.S3StorageStrategy])
], StorageService);
//# sourceMappingURL=storage.service.js.map