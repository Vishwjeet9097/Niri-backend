export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface StoredFile {
  fileName: string;
  originalName: string;
  filePath: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
}

export interface IStorageStrategy {
  uploadFile(file: UploadedFile, subFolder?: string): Promise<StoredFile>;
  deleteFile(filePath: string): Promise<boolean>;
  getSignedUrl(filePath: string): Promise<string>;
  deleteFolder(folderPath: string): Promise<boolean>;
}
