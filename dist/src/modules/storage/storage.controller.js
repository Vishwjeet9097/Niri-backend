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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const storage_service_1 = require("./storage.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const user_entity_1 = require("../../entities/user.entity");
let StorageController = class StorageController {
    constructor(storageService) {
        this.storageService = storageService;
    }
    async uploadFile(submissionId, file, req) {
        if (req.user.role !== user_entity_1.UserRole.NODAL_OFFICER) {
            throw new common_1.BadRequestException('Only Nodal Officers can upload files');
        }
        const result = await this.storageService.uploadFile(file, submissionId);
        return {
            message: 'File uploaded successfully',
            data: result,
        };
    }
    async uploadMultipleFiles(submissionId, files, req) {
        if (req.user.role !== user_entity_1.UserRole.NODAL_OFFICER) {
            throw new common_1.BadRequestException('Only Nodal Officers can upload files');
        }
        const results = await this.storageService.uploadMultipleFiles(files, submissionId);
        return {
            message: 'Files uploaded successfully',
            data: results,
            count: results.length,
        };
    }
    async deleteFile(filePath) {
        const result = await this.storageService.deleteFile(filePath);
        return {
            message: result ? 'File deleted successfully' : 'File deletion failed',
            success: result,
            details: result ? 'File removed from storage' : 'Failed to remove file',
        };
    }
    async getFileUrl(filePath) {
        const url = await this.storageService.getFileUrl(filePath);
        return {
            filePath,
            url,
            expiresIn: this.storageService.getStorageType() === 's3' ? '1 hour' : 'permanent',
        };
    }
    async getStorageInfo() {
        return {
            storageType: this.storageService.getStorageType(),
            message: `Files are stored using ${this.storageService.getStorageType()} strategy`,
        };
    }
};
exports.StorageController = StorageController;
__decorate([
    (0, common_1.Post)('upload/:submissionId'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_guard_1.Roles)(user_entity_1.UserRole.NODAL_OFFICER),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.Param)('submissionId')),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "uploadFile", null);
__decorate([
    (0, common_1.Post)('upload-multiple/:submissionId'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_guard_1.Roles)(user_entity_1.UserRole.NODAL_OFFICER),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('files', 10)),
    __param(0, (0, common_1.Param)('submissionId')),
    __param(1, (0, common_1.UploadedFiles)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Array, Object]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "uploadMultipleFiles", null);
__decorate([
    (0, common_1.Delete)(':filePath'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_guard_1.Roles)(user_entity_1.UserRole.NODAL_OFFICER, user_entity_1.UserRole.STATE_APPROVER, user_entity_1.UserRole.MOSPI_REVIEWER, user_entity_1.UserRole.MOSPI_APPROVER),
    __param(0, (0, common_1.Param)('filePath')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "deleteFile", null);
__decorate([
    (0, common_1.Get)('url/:filePath'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_guard_1.Roles)(user_entity_1.UserRole.NODAL_OFFICER, user_entity_1.UserRole.STATE_APPROVER, user_entity_1.UserRole.MOSPI_REVIEWER, user_entity_1.UserRole.MOSPI_APPROVER),
    __param(0, (0, common_1.Param)('filePath')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "getFileUrl", null);
__decorate([
    (0, common_1.Get)('storage-info'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_guard_1.Roles)(user_entity_1.UserRole.MOSPI_REVIEWER, user_entity_1.UserRole.MOSPI_APPROVER),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "getStorageInfo", null);
exports.StorageController = StorageController = __decorate([
    (0, common_1.Controller)('file'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [storage_service_1.StorageService])
], StorageController);
//# sourceMappingURL=storage.controller.js.map