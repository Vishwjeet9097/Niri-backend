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
var LocalStorageStrategy_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalStorageStrategy = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const fs = require("fs/promises");
const path = require("path");
const uuid_1 = require("uuid");
let LocalStorageStrategy = LocalStorageStrategy_1 = class LocalStorageStrategy {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(LocalStorageStrategy_1.name);
        this.storagePath = this.configService.get('STORAGE_PATH_LOCAL', './uploads');
        this.ensureStorageDirectory();
    }
    async ensureStorageDirectory() {
        try {
            await fs.mkdir(this.storagePath, { recursive: true });
            this.logger.log(`Storage directory ensured: ${this.storagePath}`);
        }
        catch (error) {
            this.logger.error(`Failed to create storage directory: ${error.message}`);
            throw error;
        }
    }
    async uploadFile(file, subFolder) {
        try {
            const fullFolderPath = subFolder ? path.join(this.storagePath, subFolder) : this.storagePath;
            await fs.mkdir(fullFolderPath, { recursive: true });
            const fileExtension = path.extname(file.originalname);
            const uniqueFileName = `${(0, uuid_1.v4)()}${fileExtension}`;
            const fullFilePath = path.join(fullFolderPath, uniqueFileName);
            await fs.writeFile(fullFilePath, file.buffer);
            const relativePath = subFolder ? path.join(subFolder, uniqueFileName) : uniqueFileName;
            const fileUrl = `/uploads/${relativePath}`;
            this.logger.log(`File uploaded successfully: ${fullFilePath}`);
            return {
                fileName: uniqueFileName,
                originalName: file.originalname,
                filePath: relativePath,
                fileUrl,
                fileSize: file.size,
                mimeType: file.mimetype,
                uploadedAt: new Date(),
            };
        }
        catch (error) {
            this.logger.error(`File upload failed: ${error.message}`);
            throw new Error(`Failed to upload file: ${error.message}`);
        }
    }
    async deleteFile(filePath) {
        try {
            const fullFilePath = path.join(this.storagePath, filePath);
            await fs.unlink(fullFilePath);
            this.logger.log(`File deleted successfully: ${fullFilePath}`);
            return true;
        }
        catch (error) {
            this.logger.error(`File deletion failed: ${error.message}`);
            return false;
        }
    }
    async getSignedUrl(filePath) {
        return `/uploads/${filePath}`;
    }
    async deleteFolder(folderPath) {
        try {
            const fullFolderPath = path.join(this.storagePath, folderPath);
            await fs.rm(fullFolderPath, { recursive: true, force: true });
            this.logger.log(`Folder deleted successfully: ${fullFolderPath}`);
            return true;
        }
        catch (error) {
            this.logger.error(`Folder deletion failed: ${error.message}`);
            return false;
        }
    }
};
exports.LocalStorageStrategy = LocalStorageStrategy;
exports.LocalStorageStrategy = LocalStorageStrategy = LocalStorageStrategy_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], LocalStorageStrategy);
//# sourceMappingURL=local-storage.strategy.js.map