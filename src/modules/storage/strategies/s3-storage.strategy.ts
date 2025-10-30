import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { UploadedFile, StoredFile, IStorageStrategy } from '../interfaces/storage.interface';
import { createReadStream } from 'fs';
import { statSync } from 'fs';
import { basename } from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class S3StorageStrategy implements IStorageStrategy {
  private readonly logger = new Logger(S3StorageStrategy.name);
  private s3: S3Client;
  private bucket: string;
  private defaultExpirySec: number;

  constructor() {
    // lazy create client with env vars
    this.s3 = new S3Client({
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

  // filePathParam can be either: 1) full key "submissions/123/uuid_name.pdf" OR 2) folder "submissions/123"
  private makeKey(file: UploadedFile | Express.Multer.File, filePathParam?: string): string {
    const original = (file as any).originalname || 'file';
    const safeOriginal = original.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    if (filePathParam && filePathParam.includes('/')) {
      // treat as full key if user already provided filename in path
      // If filePathParam ends with slash, append generated filename
      if (filePathParam.endsWith('/')) {
        return `${filePathParam}${uuidv4()}_${safeOriginal}`;
      }
      // if param looks like it already includes a filename component and an extension, use it as key
      return filePathParam;
    }
    // otherwise treat filePathParam as folder or undefined
    const folder = filePathParam ? filePathParam.replace(/\/+$/, '') : 'uploads';
    return `${folder}/${uuidv4()}_${safeOriginal}`;
  }

  async uploadFile(file: UploadedFile | Express.Multer.File, subFolder?: string): Promise<StoredFile> {
  const key = this.makeKey(file as any, subFolder);
  let body: any;
  let contentLength: number | undefined;

  // supports multer memoryStorage (buffer) or diskStorage (path)
  if ((file as any).buffer && Buffer.isBuffer((file as any).buffer)) {
    body = (file as any).buffer;
    contentLength = (file as any).buffer.length;
  } else if ((file as any).path) {
    body = createReadStream((file as any).path);
    try {
      const st = statSync((file as any).path);
      contentLength = st.size;
    } catch (e) {
      // ignore if cannot stat
    }
  } else {
    body = Buffer.from('');
    contentLength = 0;
  }

  const contentType = (file as any).mimetype || 'application/octet-stream';

  const cmd = new PutObjectCommand({
    Bucket: this.bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  await this.s3.send(cmd);

  // ❌ REMOVE signed URL generation
  // const fileUrl = await this.getSignedUrl(key);

  // ✅ Only return key (filePath)
  const stored: StoredFile = {
    fileName: basename(key),
    originalName: (file as any).originalname || basename(key),
    filePath: key, // only path to S3 object
    fileUrl: '', // optional or remove this field from DB schema
    fileSize: contentLength || ((file as any).size || 0),
    mimeType: contentType,
    uploadedAt: new Date(),
  };

  this.logger.log(`Uploaded file to s3://${this.bucket}/${key}`);
  return stored;
}


  async deleteFile(filePath: string): Promise<boolean> {
    try {
      const cmd = new DeleteObjectCommand({ Bucket: this.bucket, Key: filePath });
      await this.s3.send(cmd);
      this.logger.log(`Deleted s3://${this.bucket}/${filePath}`);
      return true;
    } catch (err) {
      this.logger.error(`Failed to delete s3 object ${filePath}: ${(err as any).message || err}`);
      return false;
    }
  }

  async getSignedUrl(filePath: string): Promise<string> {
    const key = filePath;
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    const url = await getSignedUrl(this.s3, cmd, { expiresIn: this.defaultExpirySec });
    return url;
  }

  async deleteFolder(folderPath: string): Promise<boolean> {
    try {
      const listCmd = new ListObjectsV2Command({ Bucket: this.bucket, Prefix: folderPath.replace(/^\/+/, '') });
      const listResp = await this.s3.send(listCmd);
      const toDelete = (listResp.Contents || []).map((o) => ({ Key: o.Key! }));
      if (toDelete.length === 0) return true;

      const delCmd = new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: { Objects: toDelete },
      });
      await this.s3.send(delCmd);
      this.logger.log(`Deleted ${toDelete.length} objects under s3://${this.bucket}/${folderPath}`);
      return true;
    } catch (err) {
      this.logger.error(`Failed to delete folder ${folderPath}: ${(err as any).message || err}`);
      return false;
    }
  }
}