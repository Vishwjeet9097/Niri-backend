import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageConfigService } from './storage-config.service';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';
import { LocalStorageStrategy } from './strategies/local-storage.strategy';
import { S3StorageStrategy } from './strategies/s3-storage.strategy';

@Module({
  imports: [ConfigModule],
  controllers: [StorageController],
  providers: [
    StorageConfigService,
    StorageService,
    LocalStorageStrategy,
    S3StorageStrategy,
  ],
  exports: [StorageService, StorageConfigService],
})
export class StorageModule {}
