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
var S3StorageStrategy_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3StorageStrategy = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const uuid_1 = require("uuid");
let S3StorageStrategy = S3StorageStrategy_1 = class S3StorageStrategy {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(S3StorageStrategy_1.name);
        this.bucketName = this.configService.get('S3_BUCKET_NAME');
        this.s3Client = new client_s3_1.S3Client({
            region: this.configService.get('AWS_REGION'),
            credentials: {
                accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
                secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
            },
        });
        this.logger.log(`S3 Storage Strategy initialized for bucket: ${this.bucketName}`);
    }
    async uploadFile(file, subFolder) {
        try {
            const fileExtension = this.getFileExtension(file.originalname);
            const uniqueFileName = `${(0, uuid_1.v4)()}${fileExtension}`;
            const s3Key = subFolder ? `${subFolder}/${uniqueFileName}` : uniqueFileName;
            const uploadCommand = new client_s3_1.PutObjectCommand({
                Bucket: this.bucketName,
                Key: s3Key,
                Body: file.buffer,
                ContentType: file.mimetype,
                ContentLength: file.size,
                Metadata: {
                    originalName: file.originalname,
                    uploadedAt: new Date().toISOString(),
                },
            });
            await this.s3Client.send(uploadCommand);
            const fileUrl = `https://${this.bucketName}.s3.${this.configService.get('AWS_REGION')}.amazonaws.com/${s3Key}`;
            this.logger.log(`File uploaded to S3 successfully: ${s3Key}`);
            return {
                fileName: uniqueFileName,
                originalName: file.originalname,
                filePath: s3Key,
                fileUrl: await this.getSignedUrl(s3Key),
                fileSize: file.size,
                mimeType: file.mimetype,
                uploadedAt: new Date(),
            };
        }
        catch (error) {
            this.logger.error(`S3 upload failed: ${error.message}`);
            throw new Error(`Failed to upload file to S3: ${error.message}`);
        }
    }
    async deleteFile(filePath) {
        try {
            const deleteCommand = new client_s3_1.DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: filePath,
            });
            await this.s3Client.send(deleteCommand);
            this.logger.log(`File deleted from S3 successfully: ${filePath}`);
            return true;
        }
        catch (error) {
            this.logger.error(`S3 deletion failed: ${error.message}`);
            return false;
        }
    }
    async getSignedUrl(filePath) {
        try {
            const getObjectCommand = new client_s3_1.GetObjectCommand({
                Bucket: this.bucketName,
                Key: filePath,
            });
            const signedUrl = await (0, s3_request_presigner_1.getSignedUrl)(this.s3Client, getObjectCommand, { expiresIn: 3600 });
            return signedUrl;
        }
        catch (error) {
            this.logger.error(`Failed to generate signed URL: ${error.message}`);
            throw new Error(`Failed to generate file URL: ${error.message}`);
        }
    }
    async deleteFolder(folderPath) {
        try {
            this.logger.log(`S3 folder deletion requested for: ${folderPath}`);
            return true;
        }
        catch (error) {
            this.logger.error(`Failed to delete S3 folder: ${error.message}`);
            return false;
        }
    }
    getFileExtension(originalName) {
        const lastDotIndex = originalName.lastIndexOf('.');
        return lastDotIndex !== -1 ? originalName.substring(lastDotIndex) : '';
    }
};
exports.S3StorageStrategy = S3StorageStrategy;
exports.S3StorageStrategy = S3StorageStrategy = S3StorageStrategy_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], S3StorageStrategy);
//# sourceMappingURL=s3-storage.strategy.js.map