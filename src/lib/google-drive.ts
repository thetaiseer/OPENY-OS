/**
 * Google Drive service — server-only.
 *
 * Uses OAuth 2.0 (refresh token) for authentication.
 * Never import this file from client components.
 *
 * Folder structure: Clients/{clientName}/{year}/{monthName}/
 * Example:          Clients/Client A/2026/April/
 */

import { google } from 'googleapis';
import type { drive_v3 } from 'googleapis';
import { Readable } from 'stream';

// ── URL helpers ───────────────────────────────────────────────────────────────

/** Direct embed/view URL for images and videos. */
export function buildPreviewUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

/** Direct download URL. */
export function buildDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/** Thumbnail URL; uses Drive thumbnail endpoint as fallback. */
export function buildThumbnailUrl(fileId: string, hint?: string | null): string {
  return hint ?? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
}

// ── Month helpers ─────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** Parse monthKey "YYYY-MM" → full month name (e.g. "April"). */
export function monthKeyToMonthName(monthKey: string): string {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    throw new Error(`Invalid monthKey "${monthKey}" — expected YYYY-MM`);
  }
  const mm = parseInt(monthKey.split('-')[1], 10);
  const name = MONTH_NAMES[mm - 1];
  if (!name) throw new Error(`Invalid month number ${mm} in monthKey "${monthKey}"`);
  return name;
}

/** Parse monthKey "YYYY-MM" → year string (e.g. "2026"). */
export function monthKeyToYear(monthKey: string): string {
  return monthKey.split('-')[0];
}

/** Convert full month name back to zero-padded number (e.g. "April" → "04"). */
function monthNameToNumber(name: string): string {
  const idx = MONTH_NAMES.findIndex(m => m.toLowerCase() === name.toLowerCase());
  if (idx === -1) return '01';
  return String(idx + 1).padStart(2, '0');
}

// ── Error classes ─────────────────────────────────────────────────────────────

/** Thrown when a Drive file does not exist (404). */
export class DriveFileNotFoundError extends Error {
  constructor(fileId: string) {
    super(`Drive file not found: ${fileId}`);
    this.name = 'DriveFileNotFoundError';
  }
}

// ── Drive client ──────────────────────────────────────────────────────────────

/**
 * Extract a raw Drive ID from either a full Drive URL or a bare ID string.
 */
function extractFolderId(value: string): string {
  const patterns = [
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const m = value.match(pattern);
    if (m?.[1]) return m[1];
  }
  return value.trim();
}

/**
 * Build and return an authenticated Drive client.
 * Reads credentials from environment variables (server-side only).
 */
function getDriveClient(): { drive: drive_v3.Drive; rootFolderId: string } {
  const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  const rawFolderId  = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!clientId)     throw new Error('Missing env var: GOOGLE_OAUTH_CLIENT_ID');
  if (!clientSecret) throw new Error('Missing env var: GOOGLE_OAUTH_CLIENT_SECRET');
  if (!refreshToken) throw new Error('Missing env var: GOOGLE_OAUTH_REFRESH_TOKEN');
  if (!rawFolderId)  throw new Error('Missing env var: GOOGLE_DRIVE_FOLDER_ID');

  const rootFolderId = extractFolderId(rawFolderId);
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  return { drive, rootFolderId };
}

// ── Query string helper ───────────────────────────────────────────────────────

function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// ── Folder operations ─────────────────────────────────────────────────────────

/**
 * Find an existing folder by name inside parentId, or create it if absent.
 * Returns the folder's Drive ID.
 */
async function getOrCreateFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId: string,
): Promise<string> {
  const safeName = escapeDriveQuery(name);
  const res = await drive.files.list({
    q: `name='${safeName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id,name)',
    spaces: 'drive',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const existing = res.data.files?.[0];
  if (existing?.id) return existing.id;

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
    supportsAllDrives: true,
  });

  const newId = created.data.id;
  if (!newId) throw new Error(`Failed to create Drive folder: "${name}"`);
  return newId;
}

/**
 * Create the full folder hierarchy for an upload and return the leaf folder ID.
 *
 * Path: root / Clients / {clientName} / {year} / {monthName}
 * Example: root / Clients / Client A / 2026 / April
 */
export async function createFolderHierarchy(
  clientName: string,
  monthKey: string,
): Promise<string> {
  const { drive, rootFolderId } = getDriveClient();
  const year      = monthKeyToYear(monthKey);
  const monthName = monthKeyToMonthName(monthKey);

  const clientsFolderId = await getOrCreateFolder(drive, 'Clients', rootFolderId);
  const clientFolderId  = await getOrCreateFolder(drive, clientName, clientsFolderId);
  const yearFolderId    = await getOrCreateFolder(drive, year, clientFolderId);
  const monthFolderId   = await getOrCreateFolder(drive, monthName, yearFolderId);

  return monthFolderId;
}

// ── Upload ────────────────────────────────────────────────────────────────────

export interface DriveUploadResult {
  fileId: string;
  name: string;
  mimeType: string | null;
  fileSize: number | null;
  webViewLink: string;
  webContentLink: string;
  thumbnailLink: string | null;
}

/**
 * Upload a file to Google Drive inside the given folder.
 * Returns Drive metadata for the uploaded file.
 *
 * After upload, sets the file to public read access so it can be previewed.
 */
export async function uploadFileToDrive(
  folderId: string,
  fileName: string,
  mimeType: string,
  fileBuffer: Buffer,
): Promise<DriveUploadResult> {
  const { drive } = getDriveClient();

  // Convert buffer to readable stream for the googleapis media upload
  const stream = Readable.from(fileBuffer);

  const res = await drive.files.create({
    requestBody: {
      name:    fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: 'id,name,mimeType,size,webViewLink,webContentLink,thumbnailLink',
    supportsAllDrives: true,
  });

  const file   = res.data;
  const fileId = file.id ?? '';

  if (!fileId) throw new Error('Google Drive did not return a file ID after upload');

  // Grant public read access so the file can be previewed in the UI
  try {
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
      supportsAllDrives: true,
    });
  } catch {
    // Non-fatal: file is still accessible via the service account
  }

  return {
    fileId,
    name:           file.name           ?? fileName,
    mimeType:       file.mimeType       ?? mimeType,
    fileSize:       file.size ? parseInt(file.size, 10) : null,
    webViewLink:    file.webViewLink    ?? `https://drive.google.com/file/d/${fileId}/view`,
    webContentLink: file.webContentLink ?? `https://drive.google.com/uc?id=${fileId}&export=download`,
    thumbnailLink:  file.thumbnailLink  ?? null,
  };
}

// ── File operations ───────────────────────────────────────────────────────────

/**
 * Delete a file from Google Drive.
 * @throws DriveFileNotFoundError when the file is already gone (404).
 */
export async function deleteFromDrive(fileId: string): Promise<void> {
  const { drive } = getDriveClient();
  try {
    await drive.files.delete({ fileId, supportsAllDrives: true });
  } catch (err: unknown) {
    const status  = (err as { code?: number })?.code;
    const message = err instanceof Error ? err.message : String(err);
    if (status === 404 || /not found/i.test(message)) {
      throw new DriveFileNotFoundError(fileId);
    }
    throw err;
  }
}

/**
 * Rename a file in Google Drive.
 * @throws DriveFileNotFoundError when the file is already gone (404).
 */
export async function renameInDrive(fileId: string, newName: string): Promise<void> {
  const { drive } = getDriveClient();
  try {
    await drive.files.update({
      fileId,
      supportsAllDrives: true,
      requestBody: { name: newName },
    });
  } catch (err: unknown) {
    const status  = (err as { code?: number })?.code;
    const message = err instanceof Error ? err.message : String(err);
    if (status === 404 || /not found/i.test(message)) {
      throw new DriveFileNotFoundError(fileId);
    }
    throw err;
  }
}

/**
 * Return true if the file exists in Google Drive, false on 404.
 */
export async function checkDriveFileExists(fileId: string): Promise<boolean> {
  const { drive } = getDriveClient();
  try {
    await drive.files.get({ fileId, fields: 'id', supportsAllDrives: true });
    return true;
  } catch (err: unknown) {
    const status = (err as { code?: number })?.code;
    if (status === 404) return false;
    throw err;
  }
}

/**
 * Grant public read access to a file and return its canonical URLs.
 */
export async function setFilePublicReadable(
  fileId: string,
): Promise<{ webViewLink: string; webContentLink: string }> {
  const { drive } = getDriveClient();

  try {
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
      supportsAllDrives: true,
    });
  } catch (err: unknown) {
    const status = (err as { code?: number })?.code;
    // 403 / 409 = permission already exists — harmless
    if (status !== 403 && status !== 409) {
      console.warn('[google-drive] setFilePublicReadable: permission error for', fileId, err);
    }
  }

  const metaRes = await drive.files.get({
    fileId,
    fields: 'id,webViewLink,webContentLink',
    supportsAllDrives: true,
  });

  return {
    webViewLink:    metaRes.data.webViewLink    ?? `https://drive.google.com/file/d/${fileId}/view`,
    webContentLink: metaRes.data.webContentLink ?? `https://drive.google.com/uc?id=${fileId}&export=download`,
  };
}

// ── Folder cleanup ────────────────────────────────────────────────────────────

/** Return the parent folder ID of a Drive item, or null if not found. */
async function getParentFolderId(
  drive: drive_v3.Drive,
  folderId: string,
): Promise<string | null> {
  try {
    const res = await drive.files.get({
      fileId: folderId,
      fields: 'parents',
      supportsAllDrives: true,
    });
    return res.data.parents?.[0] ?? null;
  } catch {
    return null;
  }
}

/** Return true when a Drive folder has no children. */
async function isFolderEmpty(drive: drive_v3.Drive, folderId: string): Promise<boolean> {
  const safeId = escapeDriveQuery(folderId);
  const res = await drive.files.list({
    q: `'${safeId}' in parents and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    pageSize: 1,
  });
  return (res.data.files?.length ?? 0) === 0;
}

/**
 * Walk up the folder hierarchy from the leaf (month) folder and delete each
 * level that has become empty.  Caps at 4 levels (month → year → client → Clients).
 * Errors are logged but do not propagate.
 */
export async function cleanupEmptyFoldersFromLeaf(leafFolderId: string): Promise<void> {
  const { drive } = getDriveClient();
  const MAX_LEVELS = 4;

  let currentId: string | null = leafFolderId;
  for (let level = 1; level <= MAX_LEVELS; level++) {
    if (!currentId) break;

    let parentId: string | null = null;
    try {
      parentId = await getParentFolderId(drive, currentId);
    } catch (err) {
      console.error('[google-drive] cleanup: failed to get parent of', currentId, err);
      break;
    }

    let empty = false;
    try {
      empty = await isFolderEmpty(drive, currentId);
    } catch (err) {
      console.error('[google-drive] cleanup: error checking folder', currentId, err);
      break;
    }

    if (!empty) break;

    try {
      await drive.files.delete({ fileId: currentId, supportsAllDrives: true });
    } catch (err: unknown) {
      const status = (err as { code?: number })?.code;
      if (status !== 404) {
        console.error('[google-drive] cleanup: error deleting folder', currentId, err);
      }
      break;
    }

    currentId = parentId;
  }
}

// ── Sync: scan Drive folder hierarchy ────────────────────────────────────────

export interface DriveFileMeta {
  drive_file_id: string;
  name: string;
  mime_type: string | null;
  file_size: number | null;
  created_time: string | null;
  modified_time: string | null;
  web_view_link: string | null;
  web_content_link: string | null;
  thumbnail_link: string | null;
  /** Folder name as it appears in Drive (client display name). */
  client_folder_name: string;
  /** "YYYY-MM" derived from year + month folder. */
  month_key: string;
  /** Year string (e.g. "2026"). */
  year: string;
  /** Drive ID of the month folder (leaf of hierarchy). */
  drive_folder_id: string;
}

/** List all non-trashed sub-folders inside a Drive folder. */
async function listSubFolders(
  drive: drive_v3.Drive,
  parentId: string,
): Promise<drive_v3.Schema$File[]> {
  const safeId = escapeDriveQuery(parentId);
  const res = await drive.files.list({
    q: `'${safeId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id,name)',
    spaces: 'drive',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    pageSize: 1000,
  });
  return res.data.files ?? [];
}

/** List all non-folder files in a Drive folder with full metadata. */
async function listSyncFiles(
  drive: drive_v3.Drive,
  parentId: string,
): Promise<drive_v3.Schema$File[]> {
  const safeId = escapeDriveQuery(parentId);
  const res = await drive.files.list({
    q: `'${safeId}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,thumbnailLink)',
    spaces: 'drive',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    pageSize: 1000,
  });
  return res.data.files ?? [];
}

/**
 * Scan the Drive folder hierarchy and return metadata for every file found.
 *
 * Expected structure: root / Clients / {clientName} / {year} / {monthName} / file
 */
export async function scanDriveForSync(): Promise<DriveFileMeta[]> {
  const { drive, rootFolderId } = getDriveClient();
  const results: DriveFileMeta[] = [];

  // Locate the top-level "Clients" folder
  const rootChildren = await listSubFolders(drive, rootFolderId);
  const clientsFolder = rootChildren.find(f => f.name === 'Clients');
  if (!clientsFolder?.id) {
    console.log('[google-drive] scanDriveForSync: no "Clients" folder found — nothing to sync');
    return results;
  }

  const clientFolders = await listSubFolders(drive, clientsFolder.id);
  console.log(`[google-drive] scanDriveForSync: ${clientFolders.length} client folder(s)`);

  for (const clientFolder of clientFolders) {
    if (!clientFolder.id || !clientFolder.name) continue;
    const clientFolderName = clientFolder.name;

    const yearFolders = await listSubFolders(drive, clientFolder.id);

    for (const yearFolder of yearFolders) {
      if (!yearFolder.id || !yearFolder.name) continue;
      const year = yearFolder.name;
      if (!/^\d{4}$/.test(year)) continue;

      const monthFolders = await listSubFolders(drive, yearFolder.id);

      for (const monthFolder of monthFolders) {
        if (!monthFolder.id || !monthFolder.name) continue;
        const monthName = monthFolder.name;
        const monthNum  = monthNameToNumber(monthName);
        const monthKey  = `${year}-${monthNum}`;

        const files = await listSyncFiles(drive, monthFolder.id);
        console.log(`[google-drive] scanDriveForSync: ${clientFolderName}/${year}/${monthName} — ${files.length} file(s)`);

        for (const file of files) {
          if (!file.id || !file.name) continue;
          results.push({
            drive_file_id:      file.id,
            name:               file.name,
            mime_type:          file.mimeType        ?? null,
            file_size:          file.size ? parseInt(file.size, 10) : null,
            created_time:       file.createdTime     ?? null,
            modified_time:      file.modifiedTime    ?? null,
            web_view_link:      file.webViewLink     ?? null,
            web_content_link:   file.webContentLink  ?? null,
            thumbnail_link:     file.thumbnailLink   ?? null,
            client_folder_name: clientFolderName,
            month_key:          monthKey,
            year,
            drive_folder_id:    monthFolder.id,
          });
        }
      }
    }
  }

  console.log(`[google-drive] scanDriveForSync: total ${results.length} file(s)`);
  return results;
}
