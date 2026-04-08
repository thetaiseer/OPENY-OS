/**
 * Storage provider abstraction layer.
 *
 * Import from here — never from the individual provider files.
 *
 * Usage:
 *   import { getStorageProvider, StorageFileNotFoundError } from '@/lib/storage';
 *   const provider = getStorageProvider();
 *   await provider.deleteFile(remoteId);
 */
export type {
  StorageProvider,
  StorageProviderName,
  RemoteFileMeta,
  CreateUploadSessionOptions,
  CreateUploadSessionResult,
  FinalizeUploadResult,
  GrantPublicAccessResult,
} from './types';

export { StorageFileNotFoundError } from './types';
export { GoogleDriveProvider } from './google-drive-provider';
export { getStorageProvider } from './factory';
