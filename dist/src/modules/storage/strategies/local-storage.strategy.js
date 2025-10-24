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
const fs_1 = require("fs");
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const uuid_1 = require("uuid");
let LocalStorageStrategy = LocalStorageStrategy_1 = class LocalStorageStrategy {
    constructor() {
        this.logger = new common_1.Logger(LocalStorageStrategy_1.name);
        this.basePath = process.env.STORAGE_PATH_LOCAL || './uploads';
        (0, fs_extra_1.ensureDirSync)(this.basePath);
    }
    makePath(file, subFolder) {
        const original = file.originalname || 'file';
        const safeOriginal = original.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const filename = `${(0, uuid_1.v4)()}_${safeOriginal}`;
        if (subFolder) {
            if (subFolder.includes('/') && !subFolder.endsWith('/')) {
                return (0, path_1.join)(this.basePath, subFolder);
            }
            return (0, path_1.join)(this.basePath, subFolder, filename);
        }
        return (0, path_1.join)(this.basePath, filename);
    }
    async uploadFile(file, subFolder) {
        const dest = this.makePath(file, subFolder);
        const dir = (0, path_1.join)(dest, '..');
        await fs_1.promises.mkdir(dir, { recursive: true });
        if (file.path) {
            await fs_1.promises.rename(file.path, dest);
        }
        else if (file.buffer) {
            await fs_1.promises.writeFile(dest, file.buffer);
        }
        else {
            await fs_1.promises.writeFile(dest, '');
        }
        const stats = await fs_1.promises.stat(dest);
        const relativePath = dest.replace(`${this.basePath.replace(/\/+$/, '')}/`, '');
        const stored = {
            fileName: (0, path_1.basename)(dest),
            originalName: file.originalname || (0, path_1.basename)(dest),
            filePath: relativePath,
            fileUrl: `/uploads/${relativePath}`,
            fileSize: stats.size,
            mimeType: file.mimetype || 'application/octet-stream',
            uploadedAt: new Date(),
        };
        this.logger.log(`Saved file to ${dest}`);
        return stored;
    }
    async deleteFile(filePath) {
        try {
            const pathOnDisk = (0, path_1.join)(this.basePath, filePath);
            await fs_1.promises.unlink(pathOnDisk);
            this.logger.log(`Deleted local file ${pathOnDisk}`);
            return true;
        }
        catch (err) {
            this.logger.error(`Failed to delete local file ${filePath}: ${err.message || err}`);
            return false;
        }
    }
    async getSignedUrl(filePath) {
        const utf = `/uploads/${filePath}`;
        return utf;
    }
    async deleteFolder(folderPath) {
        try {
            const pathOnDisk = (0, path_1.join)(this.basePath, folderPath);
            await fs_1.promises.rm(pathOnDisk, { recursive: true, force: true });
            this.logger.log(`Deleted local folder ${pathOnDisk}`);
            return true;
        }
        catch (err) {
            this.logger.error(`Failed to delete local folder ${folderPath}: ${err.message || err}`);
            return false;
        }
    }
};
exports.LocalStorageStrategy = LocalStorageStrategy;
exports.LocalStorageStrategy = LocalStorageStrategy = LocalStorageStrategy_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], LocalStorageStrategy);
//# sourceMappingURL=local-storage.strategy.js.map