import type { Readable } from 'stream';
import type { StorageModule } from '@/lib/storage/path-builder';

export type StorageVisibility = 'public' | 'private';

export interface UploadFileInput {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface StoredFileMetadataInput {
  id?: string;
  module: StorageModule;
  section: string;
  entityId: string | null;
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  r2Key: string;
  fileUrl: string;
  uploadedBy: string | null;
  visibility?: StorageVisibility;
}

export interface UploadFileResult {
  key: string;
  publicUrl: string;
  bucket: string;
}

export interface StorageListedFile {
  key: string;
  size?: number;
  lastModified?: Date;
}

export interface MultipartCompletedPart {
  partNumber: number;
  etag: string;
}

export interface MultipartInitResult {
  uploadId: string;
  storageKey: string;
  publicUrl: string;
  bucket: string;
}

export interface StorageObjectResult {
  body: Readable;
  contentType?: string;
  contentLength?: number;
}
