import { Injectable, Logger } from '@nestjs/common';
import { UploadedFile, StoredFile, IStorageStrategy } from '../interfaces/storage.interface';
import { promises as fsPromises, createReadStream } from 'fs';
import { ensureDirSync } from 'fs-extra';
import { join, basename } from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LocalStorageStrategy implements IStorageStrategy {
  private readonly logger = new Logger(LocalStorageStrategy.name);
  private basePath: string;

  constructor() {
    this.basePath = process.env.STORAGE_PATH_LOCAL || './uploads';
    // ensure base dir exists
    ensureDirSync(this.basePath);
  }

  private makePath(file: UploadedFile | Express.Multer.File, subFolder?: string): string {
    const original = (file as any).originalname || 'file';
    const safeOriginal = original.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const filename = `${uuidv4()}_${safeOriginal}`;

    if (subFolder) {
      // if subFolder looks like a full path with filename, use it literally
      if (subFolder.includes('/') && !subFolder.endsWith('/')) {
        // user provided a full path/key; treat as relative under basePath
        return join(this.basePath, subFolder);
      }
      return join(this.basePath, subFolder, filename);
    }
    return join(this.basePath, filename);
  }

  async uploadFile(file: UploadedFile | Express.Multer.File, subFolder?: string): Promise<StoredFile> {
    const dest = this.makePath(file as any, subFolder);
    const dir = join(dest, '..');
    await fsPromises.mkdir(dir, { recursive: true });

    // if multer diskStorage wrote file to disk, move it to dest
    if ((file as any).path) {
      // rename (move) file
      await fsPromises.rename((file as any).path, dest);
    } else if ((file as any).buffer) {
      await fsPromises.writeFile(dest, (file as any).buffer);
    } else {
      // fallback: create empty file
      await fsPromises.writeFile(dest, '');
    }

    const stats = await fsPromises.stat(dest);
    const relativePath = dest.replace(`${this.basePath.replace(/\/+$/,'')}/`, '');

    const stored: StoredFile = {
      fileName: basename(dest),
      originalName: (file as any).originalname || basename(dest),
      filePath: relativePath,
      // fileUrl: return path that client can use to download — keep as relative /uploads/...
      fileUrl: `/uploads/${relativePath}`,
      fileSize: stats.size,
      mimeType: (file as any).mimetype || 'application/octet-stream',
      uploadedAt: new Date(),
    };

    this.logger.log(`Saved file to ${dest}`);
    return stored;
  }

  async deleteFile(filePath: string): Promise<boolean> {
    try {
      const pathOnDisk = join(this.basePath, filePath);
      await fsPromises.unlink(pathOnDisk);
      this.logger.log(`Deleted local file ${pathOnDisk}`);
      return true;
    } catch (err) {
      this.logger.error(`Failed to delete local file ${filePath}: ${(err as any).message || err}`);
      return false;
    }
  }

  async getSignedUrl(filePath: string): Promise<string> {
    // For local storage return static route URL; make sure your app serves `this.basePath` at /uploads
    // If not served, return absolute path on disk
    const utf = `/uploads/${filePath}`;
    return utf;
  }

  async deleteFolder(folderPath: string): Promise<boolean> {
    try {
      const pathOnDisk = join(this.basePath, folderPath);
      // simple recursive delete
      await fsPromises.rm(pathOnDisk, { recursive: true, force: true });
      this.logger.log(`Deleted local folder ${pathOnDisk}`);
      return true;
    } catch (err) {
      this.logger.error(`Failed to delete local folder ${folderPath}: ${(err as any).message || err}`);
      return false;
    }
  }
}