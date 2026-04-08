/**
 * GoogleDriveProvider — implements StorageProvider using Google Drive.
 *
 * This is the ONLY file allowed to import from @/lib/google-drive.
 * All other routes and components must use getStorageProvider() from the
 * factory, or import directly from @/lib/storage.
 */
import {
  DriveFileNotFoundError,
  buildPreviewUrl,
  buildThumbnailUrl,
  buildDownloadUrl,
  createFolderHierarchy,
  initiateResumableSession,
  finalizeFileAfterUpload,
  deleteFromDrive,
  renameInDrive,
  checkDriveFileExists,
  setFilePublicReadable,
  scanDriveForSync,
  cleanupEmptyFoldersFromLeaf,
} from '@/lib/google-drive';
import {
  StorageFileNotFoundError,
} from './types';
import type {
  StorageProvider,
  StorageProviderName,
  RemoteFileMeta,
  CreateUploadSessionOptions,
  CreateUploadSessionResult,
  FinalizeUploadResult,
  GrantPublicAccessResult,
} from './types';

export class GoogleDriveProvider implements StorageProvider {
  readonly name: StorageProviderName = 'google-drive';

  // ── Session-based upload ──────────────────────────────────────────────────

  async createUploadSession(
    opts: CreateUploadSessionOptions,
  ): Promise<CreateUploadSessionResult> {
    const { leafFolderId } = await createFolderHierarchy(
      opts.clientFolderName,
      opts.contentType,
      opts.monthKey,
    );
    const uploadUrl = await initiateResumableSession(
      opts.fileName,
      opts.mimeType,
      opts.fileSize,
      leafFolderId,
    );
    return { uploadUrl, remoteFolderId: leafFolderId };
  }

  async finalizeUpload(remoteId: string): Promise<FinalizeUploadResult> {
    const { webViewLink, webContentLink, thumbnailLink, mimeType } =
      await finalizeFileAfterUpload(remoteId);
    return {
      viewUrl:      webViewLink,
      downloadUrl:  webContentLink,
      thumbnailLink,
      mimeType,
    };
  }

  // ── File operations ───────────────────────────────────────────────────────

  async deleteFile(remoteId: string): Promise<void> {
    try {
      await deleteFromDrive(remoteId);
    } catch (err: unknown) {
      if (err instanceof DriveFileNotFoundError) {
        throw new StorageFileNotFoundError(remoteId);
      }
      throw err;
    }
  }

  async renameFile(remoteId: string, newName: string): Promise<void> {
    try {
      await renameInDrive(remoteId, newName);
    } catch (err: unknown) {
      if (err instanceof DriveFileNotFoundError) {
        throw new StorageFileNotFoundError(remoteId);
      }
      throw err;
    }
  }

  // ── Folder / list operations ──────────────────────────────────────────────

  async listFiles(): Promise<RemoteFileMeta[]> {
    const driveFiles = await scanDriveForSync();
    return driveFiles.map(f => ({
      remote_file_id:     f.drive_file_id,
      name:               f.name,
      mime_type:          f.mime_type,
      file_size:          f.file_size,
      created_time:       f.created_time,
      modified_time:      f.modified_time,
      web_view_link:      f.web_view_link,
      web_content_link:   f.web_content_link,
      thumbnail_link:     f.thumbnail_link,
      client_folder_name: f.client_folder_name,
      content_type:       f.content_type,
      year:               f.year,
      month_key:          f.month_key,
      remote_folder_id:   f.drive_folder_id,
    }));
  }

  async fileExists(remoteId: string): Promise<boolean> {
    return checkDriveFileExists(remoteId);
  }

  async grantPublicAccess(remoteId: string): Promise<GrantPublicAccessResult> {
    const { webViewLink, webContentLink } = await setFilePublicReadable(remoteId);
    return { viewUrl: webViewLink, downloadUrl: webContentLink };
  }

  async cleanupEmptyFolders(remoteFolderId: string): Promise<void> {
    await cleanupEmptyFoldersFromLeaf(remoteFolderId);
  }

  // ── URL helpers ───────────────────────────────────────────────────────────

  getPreviewUrl(remoteId: string): string {
    return buildPreviewUrl(remoteId);
  }

  getDownloadUrl(remoteId: string): string {
    return buildDownloadUrl(remoteId);
  }

  getThumbnailUrl(remoteId: string, hint?: string | null): string {
    return buildThumbnailUrl(remoteId, hint);
  }
}
