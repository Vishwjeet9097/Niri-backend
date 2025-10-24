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
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageConfigService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let StorageConfigService = class StorageConfigService {
    constructor(configService) {
        this.configService = configService;
    }
    getStorageConfig() {
        return {
            storageType: this.configService.get('STORAGE_TYPE', 'local'),
            awsAccessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
            awsSecretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
            awsRegion: this.configService.get('S3_REGION'),
            s3BucketName: this.configService.get('S3_BUCKET_NAME'),
            storagePathLocal: this.configService.get('STORAGE_PATH_LOCAL', './uploads'),
        };
    }
    isS3Enabled() {
        return this.getStorageConfig().storageType === 's3';
    }
    validateConfig() {
        const config = this.getStorageConfig();
        if (config.storageType === 's3') {
            if (!config.awsAccessKeyId || !config.awsSecretAccessKey || !config.awsRegion || !config.s3BucketName) {
                throw new Error('S3 configuration is incomplete. Please provide AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_REGION, and S3_BUCKET_NAME');
            }
        }
    }
};
exports.StorageConfigService = StorageConfigService;
exports.StorageConfigService = StorageConfigService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], StorageConfigService);
//# sourceMappingURL=storage-config.service.js.map