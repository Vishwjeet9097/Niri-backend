"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const storage_config_service_1 = require("./storage-config.service");
const storage_service_1 = require("./storage.service");
const storage_controller_1 = require("./storage.controller");
const local_storage_strategy_1 = require("./strategies/local-storage.strategy");
const s3_storage_strategy_1 = require("./strategies/s3-storage.strategy");
let StorageModule = class StorageModule {
};
exports.StorageModule = StorageModule;
exports.StorageModule = StorageModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule],
        controllers: [storage_controller_1.StorageController],
        providers: [
            storage_config_service_1.StorageConfigService,
            storage_service_1.StorageService,
            local_storage_strategy_1.LocalStorageStrategy,
            s3_storage_strategy_1.S3StorageStrategy,
        ],
        exports: [storage_service_1.StorageService, storage_config_service_1.StorageConfigService],
    })
], StorageModule);
//# sourceMappingURL=storage.module.js.map