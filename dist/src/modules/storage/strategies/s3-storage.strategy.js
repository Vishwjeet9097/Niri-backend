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
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const fs_1 = require("fs");
const fs_2 = require("fs");
const path_1 = require("path");
const uuid_1 = require("uuid");
let S3StorageStrategy = S3StorageStrategy_1 = class S3StorageStrategy {
    constructor() {
        this.logger = new common_1.Logger(S3StorageStrategy_1.name);
        this.s3 = new client_s3_1.S3Client({
            region: process.env.S3_REGION || 'us-east-1',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
            },
        });
        this.bucket = process.env.S3_BUCKET_NAME || process.env.S3_BUCKET || '';
        this.defaultExpirySec = Number(process.env.S3_SIGNED_URL_EXPIRATION || 3600);
        if (!this.bucket) {
            this.logger.warn('S3 bucket name not configured (S3_BUCKET_NAME or S3_BUCKET). S3 operations will likely fail.');
        }
    }
    makeKey(file, filePathParam) {
        const original = file.originalname || 'file';
        const safeOriginal = original.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        if (filePathParam && filePathParam.includes('/')) {
            if (filePathParam.endsWith('/')) {
                return `${filePathParam}${(0, uuid_1.v4)()}_${safeOriginal}`;
            }
            return filePathParam;
        }
        const folder = filePathParam ? filePathParam.replace(/\/+$/, '') : 'uploads';
        return `${folder}/${(0, uuid_1.v4)()}_${safeOriginal}`;
    }
    async uploadFile(file, subFolder) {
        const key = this.makeKey(file, subFolder);
        let body;
        let contentLength;
        if (file.buffer && Buffer.isBuffer(file.buffer)) {
            body = file.buffer;
            contentLength = file.buffer.length;
        }
        else if (file.path) {
            body = (0, fs_1.createReadStream)(file.path);
            try {
                const st = (0, fs_2.statSync)(file.path);
                contentLength = st.size;
            }
            catch (e) {
            }
        }
        else {
            body = Buffer.from('');
            contentLength = 0;
        }
        const contentType = file.mimetype || 'application/octet-stream';
        const cmd = new client_s3_1.PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
        });
        await this.s3.send(cmd);
        const fileUrl = await this.getSignedUrl(key);
        const stored = {
            fileName: (0, path_1.basename)(key),
            originalName: file.originalname || (0, path_1.basename)(key),
            filePath: key,
            fileUrl,
            fileSize: contentLength || (file.size || 0),
            mimeType: contentType,
            uploadedAt: new Date(),
        };
        this.logger.log(`Uploaded file to s3://${this.bucket}/${key}`);
        return stored;
    }
    async deleteFile(filePath) {
        try {
            const cmd = new client_s3_1.DeleteObjectCommand({ Bucket: this.bucket, Key: filePath });
            await this.s3.send(cmd);
            this.logger.log(`Deleted s3://${this.bucket}/${filePath}`);
            return true;
        }
        catch (err) {
            this.logger.error(`Failed to delete s3 object ${filePath}: ${err.message || err}`);
            return false;
        }
    }
    async getSignedUrl(filePath) {
        const key = filePath;
        const cmd = new client_s3_1.GetObjectCommand({ Bucket: this.bucket, Key: key });
        const url = await (0, s3_request_presigner_1.getSignedUrl)(this.s3, cmd, { expiresIn: this.defaultExpirySec });
        return url;
    }
    async deleteFolder(folderPath) {
        try {
            const listCmd = new client_s3_1.ListObjectsV2Command({ Bucket: this.bucket, Prefix: folderPath.replace(/^\/+/, '') });
            const listResp = await this.s3.send(listCmd);
            const toDelete = (listResp.Contents || []).map((o) => ({ Key: o.Key }));
            if (toDelete.length === 0)
                return true;
            const delCmd = new client_s3_1.DeleteObjectsCommand({
                Bucket: this.bucket,
                Delete: { Objects: toDelete },
            });
            await this.s3.send(delCmd);
            this.logger.log(`Deleted ${toDelete.length} objects under s3://${this.bucket}/${folderPath}`);
            return true;
        }
        catch (err) {
            this.logger.error(`Failed to delete folder ${folderPath}: ${err.message || err}`);
            return false;
        }
    }
};
exports.S3StorageStrategy = S3StorageStrategy;
exports.S3StorageStrategy = S3StorageStrategy = S3StorageStrategy_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], S3StorageStrategy);
//# sourceMappingURL=s3-storage.strategy.js.map