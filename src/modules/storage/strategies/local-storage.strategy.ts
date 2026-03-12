import { Injectable, Logger } from '@nestjs/common';
import { UploadedFile, StoredFile, IStorageStrategy } from '../interfaces/storage.interface';
import { promises as fsPromises, createReadStream , statSync, existsSync} from 'fs';
import { ensureDirSync } from 'fs-extra';
import { join, basename, resolve } from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LocalStorageStrategy implements IStorageStrategy {
  private readonly logger = new Logger(LocalStorageStrategy.name);
  private basePath: string;

  constructor() {
    this.basePath = process.env.STORAGE_PATH_LOCAL;
    if (!this.basePath || typeof this.basePath !== 'string') {
      throw new Error('STORAGE_PATH_LOCAL environment variable is not set or is invalid.');
    }
    // For absolute paths (e.g. /neibackend NFS mount): directory must already exist
    // For relative paths (e.g. ./uploads): create if needed
    if (this.basePath.startsWith('/')) {
      if (!existsSync(this.basePath)) {
        throw new Error(
          `Storage path ${this.basePath} does not exist. For NFS: ensure the share is mounted. For local: create it with "sudo mkdir -p ${this.basePath} && sudo chown $USER ${this.basePath}"`
        );
      }
    } else {
      ensureDirSync(this.basePath);
    }
  }

  private makePath(file: UploadedFile | Express.Multer.File, subFolder?: string): string {
    const original = (file as any).originalname || 'file';
    const safeOriginal = typeof original === 'string' && original ? original.replace(/[^a-zA-Z0-9.\-_]/g, '_') : 'file';
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
    const resolvedBase = resolve(this.basePath);
    const resolvedDest = resolve(dest);
    const relativePath = resolvedDest.startsWith(resolvedBase)
      ? resolvedDest.slice(resolvedBase.length).replace(/^\/+/, '')
      : dest;

    const stored: StoredFile = {
      fileName: basename(dest),
      originalName: (file as any).originalname || basename(dest),
      filePath: relativePath,
      // fileUrl: return path that client can use to download — keep as relative /uploads/...
      fileUrl: `${relativePath}`,
      fileSize: stats.size,
      mimeType: (file as any).mimetype || 'application/octet-stream',
      uploadedAt: new Date(),
    };

    this.logger.log(`Saved file to ${dest}`);
    return stored;
  }

  async deleteFile(filePath: string): Promise<boolean> {
    try {
      let pathOnDisk = join(this.basePath, filePath);
      if (!existsSync(pathOnDisk)) {
        const altPath = resolve(process.cwd(), filePath);
        if (existsSync(altPath)) pathOnDisk = altPath;
      }
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
    const utf = `${filePath}`;
    this.logger.log('LocalStorageStrategy.getSignedUrl returning', utf);
    return utf;
  }
  async getFileStream(filePath: string): Promise<{
    stream: NodeJS.ReadableStream;
    contentType: string;
    contentLength?: number;
    fileName?: string;
  }> {
    let fullPath = join(this.basePath, filePath);
    if (!existsSync(fullPath)) {
      const altPath = resolve(process.cwd(), filePath);
      if (existsSync(altPath)) {
        fullPath = altPath;
      } else {
        throw new Error(`File not found: ${filePath}`);
      }
    }
  
    const stats = statSync(fullPath);
    const fileName = basename(fullPath);
  
    // Simple content type detection (you may want to use a library like 'mime-types')
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const contentTypeMap: Record<string, string> = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      txt: 'text/plain',
      csv: 'text/csv',
    };
  
    return {
      stream: createReadStream(fullPath),
      contentType: contentTypeMap[ext] || 'application/octet-stream',
      contentLength: stats.size,
      fileName: fileName,
    };
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