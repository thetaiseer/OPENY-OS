/**
 * Provider-agnostic storage abstraction types.
 *
 * All API routes and page components MUST import from this module (or from
 * @/lib/storage) — they MUST NOT import from @/lib/google-drive directly.
 *
 * Planned providers: OneDriveProvider, S3Provider, LocalProvider.
 * Active provider:   GoogleDriveProvider (selected via STORAGE_PROVIDER=google-drive).
 */

/** Supported provider identifiers. Extend this union when adding new providers. */
export type StorageProviderName = 'google-drive';

// ── Error classes ─────────────────────────────────────────────────────────────

/**
 * Thrown by any StorageProvider method when the requested remote file does not
 * exist.  Routes should catch this and return 404 / treat as orphaned record.
 */
export class StorageFileNotFoundError extends Error {
  readonly remoteId: string;
  constructor(remoteId: string) {
    super(`Remote file not found: ${remoteId}`);
    this.name = 'StorageFileNotFoundError';
    this.remoteId = remoteId;
  }
}

// ── Data shapes ───────────────────────────────────────────────────────────────

/**
 * Provider-agnostic file metadata returned by StorageProvider.listFiles().
 *
 * Field names use the provider-neutral "remote_" prefix so routes are not
 * coupled to Drive-specific column names.  When persisting to the database
 * the route maps these to the actual column names (e.g. drive_file_id).
 */
export interface RemoteFileMeta {
  /** Unique file identifier within the provider (e.g. Google Drive file ID). */
  remote_file_id: string;
  name: string;
  mime_type: string | null;
  file_size: number | null;
  created_time: string | null;
  modified_time: string | null;
  web_view_link: string | null;
  web_content_link: string | null;
  /** Provider thumbnail URL hint (may be null for private or newly uploaded files). */
  thumbnail_link: string | null;
  client_folder_name: string;
  content_type: string;
  year: string;
  month_key: string;
  /** Unique folder identifier within the provider (e.g. Drive month-folder ID). */
  remote_folder_id: string;
}

/** Options for StorageProvider.createUploadSession(). */
export interface CreateUploadSessionOptions {
  /** Final file name to store in the provider (after any renaming). */
  fileName: string;
  mimeType: string;
  fileSize: number;
  clientFolderName: string;
  contentType: string;
  /** "YYYY-MM" */
  monthKey: string;
}

/** Result of StorageProvider.createUploadSession(). */
export interface CreateUploadSessionResult {
  /** Pre-authenticated URL the browser PUT-uploads file bytes directly to. */
  uploadUrl: string;
  /** Remote folder ID where the file will land after upload. */
  remoteFolderId: string;
}

/** Result of StorageProvider.finalizeUpload(). */
export interface FinalizeUploadResult {
  /** Canonical URL for viewing the file inline. */
  viewUrl: string;
  /** Direct download URL. */
  downloadUrl: string;
  thumbnailLink: string | null;
  mimeType: string | null;
}

/** Result of StorageProvider.grantPublicAccess(). */
export interface GrantPublicAccessResult {
  viewUrl: string;
  downloadUrl: string;
}

// ── Provider contract ─────────────────────────────────────────────────────────

/**
 * The storage provider contract.
 *
 * All upload flows, delete/rename operations, sync, and URL generation go
 * through this interface.  Adding a new provider (OneDrive, S3, …) requires
 * only implementing this interface and registering it in the factory — no
 * page component or route needs to change.
 */
export interface StorageProvider {
  /** Human-readable identifier, e.g. 'google-drive'. */
  readonly name: StorageProviderName;

  // ── Session-based (client-side direct) upload ─────────────────────────────

  /**
   * Create a resumable upload session.
   * Returns a pre-authenticated URL the client browser uploads directly to,
   * plus the remote folder ID where the file will reside.
   */
  createUploadSession(opts: CreateUploadSessionOptions): Promise<CreateUploadSessionResult>;

  /**
   * Finalize a completed upload: grant public read access and return URLs.
   * Called after the browser confirms all bytes are uploaded.
   */
  finalizeUpload(remoteId: string): Promise<FinalizeUploadResult>;

  // ── File operations ───────────────────────────────────────────────────────

  /**
   * Permanently delete a remote file.
   * @throws StorageFileNotFoundError when the file does not exist.
   */
  deleteFile(remoteId: string): Promise<void>;

  /**
   * Rename a remote file.
   * @throws StorageFileNotFoundError when the file does not exist.
   */
  renameFile(remoteId: string, newName: string): Promise<void>;

  // ── Folder / list operations ──────────────────────────────────────────────

  /**
   * Scan the provider storage and return metadata for every file found.
   * Used by the sync route to reconcile DB state with remote state.
   */
  listFiles(): Promise<RemoteFileMeta[]>;

  /** Return true if the remote file exists; false on 404. */
  fileExists(remoteId: string): Promise<boolean>;

  /**
   * Grant public read access to a file and return its canonical URLs.
   * Used during sync when inserting new records.
   */
  grantPublicAccess(remoteId: string): Promise<GrantPublicAccessResult>;

  /**
   * Clean up empty parent folders from the given leaf folder upward.
   * Optional — providers without a folder hierarchy may omit this.
   */
  cleanupEmptyFolders?(remoteFolderId: string): Promise<void>;

  // ── URL helpers ───────────────────────────────────────────────────────────

  /** Inline preview URL (e.g. for images and videos). */
  getPreviewUrl(remoteId: string): string;

  /** Direct download URL. */
  getDownloadUrl(remoteId: string): string;

  /**
   * Thumbnail URL.  Pass the hint returned by the provider API to avoid an
   * extra round-trip; a fallback URL is constructed if hint is null/undefined.
   */
  getThumbnailUrl(remoteId: string, hint?: string | null): string;
}
