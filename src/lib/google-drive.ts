/**
 * Server-only Google Drive utility.
 * Uses OAuth 2.0 (refresh token) — no Service Account required.
 * Never import this file from client components.
 */
import { google } from 'googleapis';
import type { drive_v3 } from 'googleapis';
import { clientToFolderName } from './asset-utils';

// ── Allowed content types ──────────────────────────────────────────────────────
export const ALLOWED_CONTENT_TYPES = [
  'SOCIAL_POSTS',
  'REELS',
  'VIDEOS',
  'LOGOS',
  'BRAND_ASSETS',
  'PASSWORDS',
  'DOCUMENTS',
  'RAW_FILES',
  'ADS_CREATIVES',
  'REPORTS',
  'OTHER',
] as const;
export type AllowedContentType = typeof ALLOWED_CONTENT_TYPES[number];
// ── Result type ───────────────────────────────────────────────────────────────

export interface DriveUploadResult {
  drive_file_id: string;
  drive_folder_id: string;
  client_folder_name: string | null;
  webViewLink: string;
  webContentLink: string;
  thumbnailLink: string | null;
  mimeType: string | null;
  fileSize: number | null;
}

// ── Preview URL helpers ───────────────────────────────────────────────────────

/** Direct embed URL for inline image/video rendering (no Drive redirect). */
export function buildPreviewUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

/** Thumbnail URL; falls back to Drive thumbnail endpoint if Drive didn't return one. */
export function buildThumbnailUrl(fileId: string, thumbnailLink?: string | null): string {
  return thumbnailLink ?? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
}

/** Direct download URL. */
export function buildDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

// ── String helpers ────────────────────────────────────────────────────────────

/**
 * Extract a raw Google Drive folder/file ID from either a full URL or a bare ID.
 *
 * Handles:
 *   https://drive.google.com/drive/folders/FOLDER_ID
 *   https://drive.google.com/drive/folders/FOLDER_ID?usp=sharing
 *   https://drive.google.com/open?id=FOLDER_ID
 *   https://drive.google.com/file/d/FILE_ID/view
 *   raw bare ID  (returned as-is)
 *
 * THE PRIMARY FIX: if GOOGLE_DRIVE_FOLDER_ID is set to a full URL,
 * the raw value contains slashes which break gaxios URL construction.
 */
export function extractDriveId(value: string): string {
  if (!value || !value.trim()) {
    throw new Error('extractDriveId: received empty or whitespace-only string');
  }
  const trimmed = value.trim();

  const urlPatterns: RegExp[] = [
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of urlPatterns) {
    const m = trimmed.match(pattern);
    if (m?.[1]) {
      console.log('[google-drive] extractDriveId: extracted raw ID', m[1], 'from URL value');
      return m[1];
    }
  }

  console.log('[google-drive] extractDriveId: value appears to be a raw ID:', trimmed);
  return trimmed;
}

/**
 * Validate that a URL string is parseable. Throws with context on failure.
 */
function assertValidUrl(url: string, label: string): void {
  try {
    new URL(url);
  } catch {
    throw new Error(`${label} is not a valid URL: "${url}"`);
  }
}

// ── Drive client factory (OAuth 2.0) ─────────────────────────────────────────

/**
 * Build a Drive client authenticated via OAuth 2.0 (refresh token).
 * Credentials are supplied via env vars:
 *   GOOGLE_OAUTH_CLIENT_ID      – OAuth client ID
 *   GOOGLE_OAUTH_CLIENT_SECRET  – OAuth client secret
 *   GOOGLE_OAUTH_REFRESH_TOKEN  – long-lived refresh token
 *   GOOGLE_DRIVE_FOLDER_ID      – root Drive folder ID (or full URL)
 */
function getDriveClient() {
  const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  const rawFolderId  = process.env.GOOGLE_DRIVE_FOLDER_ID;

  console.log('[google-drive] init — GOOGLE_OAUTH_CLIENT_ID present:', !!clientId);
  console.log('[google-drive] init — GOOGLE_OAUTH_CLIENT_SECRET present:', !!clientSecret);
  console.log('[google-drive] init — GOOGLE_OAUTH_REFRESH_TOKEN present:', !!refreshToken);
  console.log('[google-drive] init — GOOGLE_DRIVE_FOLDER_ID raw value:', rawFolderId ?? '(missing)');

  if (!clientId) {
    throw new Error('Missing env var: GOOGLE_OAUTH_CLIENT_ID');
  }
  if (!clientSecret) {
    throw new Error('Missing env var: GOOGLE_OAUTH_CLIENT_SECRET');
  }
  if (!refreshToken) {
    throw new Error('Missing env var: GOOGLE_OAUTH_REFRESH_TOKEN');
  }
  if (!rawFolderId) {
    throw new Error('Missing env var: GOOGLE_DRIVE_FOLDER_ID');
  }

  // Always extract the bare folder ID, even if a full URL was stored in env
  const folderId = extractDriveId(rawFolderId);
  console.log('[google-drive] init — folder_id (after extractDriveId):', folderId);

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  console.log('[google-drive] OAuth2 client created successfully');
  return { drive: google.drive({ version: 'v3', auth: oauth2Client }), rootFolderId: folderId, auth: oauth2Client };
}

/**
 * Convert a client name to a normalized folder name.
 * Delegates to the shared clientToFolderName utility.
 */
export { clientToFolderName as toClientFolderName };

/**
 * Escape a string for use inside a Google Drive API query's single-quoted string literal.
 * Escapes backslashes first, then single quotes.
 */
function escapeDriveQueryString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// ── Month helpers ─────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/**
 * Split a YYYY-MM monthKey into the two Drive folder name components:
 *   year       – e.g. "2026"
 *   monthFolder – e.g. "04-April"
 */
function monthKeyToComponents(monthKey: string): { year: string; monthFolder: string } {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    throw new Error(`monthKeyToComponents: invalid monthKey format "${monthKey}" — expected YYYY-MM`);
  }
  const [year, mm] = monthKey.split('-') as [string, string];
  const monthIndex = parseInt(mm, 10) - 1;
  let monthName: string;
  if (monthIndex >= 0 && monthIndex < MONTH_NAMES.length) {
    monthName = MONTH_NAMES[monthIndex];
  } else {
    console.warn(`[google-drive] monthKeyToComponents: unexpected month index ${monthIndex} for monthKey "${monthKey}" — using raw mm value`);
    monthName = mm;
  }
  return { year, monthFolder: `${mm}-${monthName}` };
}

// ── Folder helpers ────────────────────────────────────────────────────────────

/**
 * Find an existing folder by name under parentId, or create it if absent.
 * Returns the folder's Drive ID.
 */
async function getOrCreateFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId: string,
): Promise<string> {
  const safeName = escapeDriveQueryString(name);
  const searchRes = await drive.files.list({
    q: `name='${safeName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id,name)',
    spaces: 'drive',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const existing = searchRes.data.files?.[0];
  if (existing?.id) {
    console.log(`[google-drive] folder "${name}" already exists — id:`, existing.id);
    return existing.id;
  }

  const createRes = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
    supportsAllDrives: true,
  });

  const newId = createRes.data.id;
  if (!newId) throw new Error(`Failed to create Drive folder: ${name}`);
  console.log(`[google-drive] created folder "${name}" — id:`, newId);
  return newId;
}

// ── Delete ────────────────────────────────────────────────────────────────────

/** Thrown when the Drive file is already gone (404 / notFound). */
export class DriveFileNotFoundError extends Error {
  constructor(fileId: string) {
    super(`File not found: ${fileId}`);
    this.name = 'DriveFileNotFoundError';
  }
}

/**
 * Delete a file from Google Drive by its file ID.
 * Throws DriveFileNotFoundError when the file is missing (404).
 * Throws on any other failure so the caller can surface the exact error.
 */
export async function deleteFromDrive(fileId: string): Promise<void> {
  const { drive } = getDriveClient();
  try {
    await drive.files.delete({ fileId, supportsAllDrives: true });
  } catch (err: unknown) {
    // Treat a 404 / "File not found" response as a missing-remote signal
    // so callers can decide to proceed with DB cleanup instead of hard-failing.
    const status = (err as { code?: number })?.code;
    const message = err instanceof Error ? err.message : String(err);
    if (status === 404 || /not found/i.test(message)) {
      throw new DriveFileNotFoundError(fileId);
    }
    throw err;
  }
}

/**
 * Rename a file in Google Drive.
 * Throws DriveFileNotFoundError when the file is missing (404).
 * Throws on any other failure.
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
    const status = (err as { code?: number })?.code;
    const message = err instanceof Error ? err.message : String(err);
    if (status === 404 || /not found/i.test(message)) {
      throw new DriveFileNotFoundError(fileId);
    }
    throw err;
  }
}

// ── Folder cleanup helpers ────────────────────────────────────────────────────

/**
 * Return the parent folder ID of a Drive item, or null if none is found.
 */
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
    const parents = res.data.parents;
    return parents?.[0] ?? null;
  } catch (err: unknown) {
    const status = (err as { code?: number })?.code;
    const message = err instanceof Error ? err.message : String(err);
    if (status === 404 || /not found/i.test(message)) {
      return null;
    }
    throw err;
  }
}

/**
 * List all non-trashed children (files and folders) inside a Drive folder.
 * Returns an array of file metadata objects.
 */
export async function listFolderChildren(
  drive: drive_v3.Drive,
  folderId: string,
): Promise<drive_v3.Schema$File[]> {
  const safeId = escapeDriveQueryString(folderId);
  const res = await drive.files.list({
    q: `'${safeId}' in parents and trashed=false`,
    fields: 'files(id,name,mimeType)',
    spaces: 'drive',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files ?? [];
}

/**
 * Return true when a Drive folder has no remaining children.
 */
export async function isFolderEmpty(
  drive: drive_v3.Drive,
  folderId: string,
): Promise<boolean> {
  const children = await listFolderChildren(drive, folderId);
  return children.length === 0;
}

/**
 * Delete a Drive folder only when it is empty.
 * Silently ignores "File not found" so the function is safe to call multiple times.
 * Returns true when the folder was deleted, false otherwise.
 */
export async function deleteFolderIfEmpty(
  drive: drive_v3.Drive,
  folderId: string,
): Promise<boolean> {
  const empty = await isFolderEmpty(drive, folderId);
  if (!empty) {
    console.log('[google-drive] deleteFolderIfEmpty: folder not empty — skipping', folderId);
    return false;
  }

  try {
    await drive.files.delete({ fileId: folderId, supportsAllDrives: true });
    console.log('[google-drive] deleteFolderIfEmpty: deleted empty folder', folderId);
    return true;
  } catch (err: unknown) {
    const status = (err as { code?: number })?.code;
    const message = err instanceof Error ? err.message : String(err);
    if (status === 404 || /not found/i.test(message)) {
      console.warn('[google-drive] deleteFolderIfEmpty: folder already gone', folderId);
      return false;
    }
    throw err;
  }
}

/**
 * After a file is deleted, walk up the folder hierarchy from the leaf (month)
 * folder and delete each level that has become empty.
 *
 * Hierarchy levels checked (max 4, starting from leaf):
 *   month folder → year folder → content-type folder → client folder
 *
 * Safety: never deletes the "Clients" folder or the Drive root.  The walk is
 * capped at MAX_LEVELS = 4 so it can never climb higher than the client folder.
 *
 * Errors inside cleanup do NOT propagate — they are logged only, so that the
 * caller's delete flow is unaffected.
 */
export async function cleanupEmptyFoldersFromLeaf(monthFolderId: string): Promise<void> {
  const { drive } = getDriveClient();

  // Maximum levels to walk upward: month(1) → year(2) → contentType(3) → client(4)
  const MAX_LEVELS = 4;

  let currentFolderId: string | null = monthFolderId;

  for (let level = 1; level <= MAX_LEVELS; level++) {
    if (!currentFolderId) break;

    console.log(`[google-drive] cleanup level ${level}: checking folder`, currentFolderId);

    // Capture the parent ID before potentially deleting the current folder
    let parentId: string | null = null;
    try {
      parentId = await getParentFolderId(drive, currentFolderId);
    } catch (err: unknown) {
      console.error(`[google-drive] cleanup: failed to get parent of`, currentFolderId, err);
      break;
    }

    let deleted = false;
    try {
      deleted = await deleteFolderIfEmpty(drive, currentFolderId);
    } catch (err: unknown) {
      console.error(`[google-drive] cleanup: error deleting folder`, currentFolderId, err);
      break;
    }

    if (!deleted) {
      // Folder is not empty — stop walking upward
      break;
    }

    console.log(`[google-drive] cleanup level ${level}: deleted empty folder`, currentFolderId);
    currentFolderId = parentId;
  }

  if (currentFolderId) {
    // We stopped (either folder not empty or max levels reached) — log final state
    console.log('[google-drive] cleanup: finished. Remaining folder (not deleted):', currentFolderId);
  } else {
    console.log('[google-drive] cleanup: all checked folders were removed or no parent found');
  }
}

// ── Drive Sync helpers ────────────────────────────────────────────────────────

/**
 * Metadata for a single file discovered during a Google Drive sync scan.
 * The folder chain is parsed into structured fields.
 *
 * Folder path expected: root / Clients / {client_folder_name} / {CONTENT_TYPE} / {year} / {MM-MonthName} / file
 */
export interface DriveFileMeta {
  drive_file_id: string;
  name: string;
  mime_type: string | null;
  file_size: number | null;
  created_time: string | null;
  modified_time: string | null;
  web_view_link: string | null;
  web_content_link: string | null;
  /** Drive thumbnail URL returned by the list API (may be null for private/new files). */
  thumbnail_link: string | null;
  client_folder_name: string;
  content_type: string;
  year: string;
  month_key: string;
  drive_folder_id: string;
}

/**
 * List all direct sub-folders of a Drive folder (non-recursive).
 * Returns only folders (not regular files).
 */
async function listSubFolders(
  drive: drive_v3.Drive,
  parentId: string,
): Promise<drive_v3.Schema$File[]> {
  const safeId = escapeDriveQueryString(parentId);
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

/**
 * List all non-folder files in a Drive folder with full metadata needed for sync.
 */
async function listSyncFiles(
  drive: drive_v3.Drive,
  parentId: string,
): Promise<drive_v3.Schema$File[]> {
  const safeId = escapeDriveQueryString(parentId);
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
 * Check whether a specific Drive file exists (returns false on 404, re-throws on other errors).
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
 * Grant public read access to a Drive file and return its canonical links.
 * Silently ignores permission-already-exists errors.
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
    // Code 403 or 409 means permission already exists — ignore.
    const status = (err as { code?: number })?.code;
    if (status !== 403 && status !== 409) {
      console.warn('[google-drive] setFilePublicReadable: could not set permission for', fileId, err);
    }
  }

  const metaRes = await drive.files.get({
    fileId,
    fields: 'id,webViewLink,webContentLink',
    supportsAllDrives: true,
  });

  const rawView = metaRes.data.webViewLink ?? '';
  const rawDownload = metaRes.data.webContentLink ?? '';

  let webViewLink = rawView;
  try { assertValidUrl(rawView, 'webViewLink'); } catch {
    webViewLink = `https://drive.google.com/file/d/${fileId}/view`;
  }

  let webContentLink = rawDownload;
  try { assertValidUrl(rawDownload, 'webContentLink'); } catch {
    webContentLink = `https://drive.google.com/uc?id=${fileId}&export=download`;
  }

  return { webViewLink, webContentLink };
}

/**
 * Scan the entire Google Drive Clients folder hierarchy and return metadata for
 * every file found.
 *
 * Expected Drive path: root / Clients / {clientFolder} / {year} / {MM-MonthName} / {CONTENT_TYPE} / file
 *
 * Files outside this structure are ignored.
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
  console.log(`[google-drive] scanDriveForSync: found ${clientFolders.length} client folder(s)`);

  for (const clientFolder of clientFolders) {
    if (!clientFolder.id || !clientFolder.name) continue;
    const clientFolderName = clientFolder.name;

    // Level 2: year folders
    const yearFolders = await listSubFolders(drive, clientFolder.id);

    for (const yearFolder of yearFolders) {
      if (!yearFolder.id || !yearFolder.name) continue;
      const year = yearFolder.name;
      if (!/^\d{4}$/.test(year)) {
        console.log(`[google-drive] scanDriveForSync: skipping non-year folder "${year}" under "${clientFolderName}"`);
        continue;
      }

      // Level 3: month folders (MM-MonthName)
      const monthFolders = await listSubFolders(drive, yearFolder.id);

      for (const monthFolder of monthFolders) {
        if (!monthFolder.id || !monthFolder.name) continue;

        // Parse MM from folder name like "04-April" and validate range
        const mmMatch = monthFolder.name.match(/^(\d{2})-/);
        if (!mmMatch) {
          console.log(`[google-drive] scanDriveForSync: skipping unrecognised month folder "${monthFolder.name}"`);
          continue;
        }
        const mm = mmMatch[1];
        const mmNum = parseInt(mm, 10);
        if (mmNum < 1 || mmNum > 12) {
          console.log(`[google-drive] scanDriveForSync: skipping out-of-range month folder "${monthFolder.name}" (mm=${mm})`);
          continue;
        }
        const monthKey = `${year}-${mm}`;

        // Level 4: content type folders
        const contentTypeFolders = await listSubFolders(drive, monthFolder.id);

        for (const ctFolder of contentTypeFolders) {
          if (!ctFolder.id || !ctFolder.name) continue;
          const contentType = ctFolder.name;

          // Skip folders whose names don't match a known content type
          if (!(ALLOWED_CONTENT_TYPES as readonly string[]).includes(contentType)) {
            console.log(`[google-drive] scanDriveForSync: skipping unknown content type folder "${contentType}" under "${clientFolderName}/${year}/${monthFolder.name}"`);
            continue;
          }

          const files = await listSyncFiles(drive, ctFolder.id);
          console.log(`[google-drive] scanDriveForSync: ${clientFolderName}/${year}/${monthFolder.name}/${contentType} — ${files.length} file(s)`);

          for (const file of files) {
            if (!file.id || !file.name) continue;
            results.push({
              drive_file_id: file.id,
              name: file.name,
              mime_type: file.mimeType ?? null,
              file_size: file.size ? parseInt(file.size, 10) : null,
              created_time: file.createdTime ?? null,
              modified_time: file.modifiedTime ?? null,
              web_view_link: file.webViewLink ?? null,
              web_content_link: file.webContentLink ?? null,
              thumbnail_link: file.thumbnailLink ?? null,
              client_folder_name: clientFolderName,
              content_type: contentType,
              year,
              month_key: monthKey,
              drive_folder_id: ctFolder.id,
            });
          }
        }
      }
    }
  }

  console.log(`[google-drive] scanDriveForSync: total files found: ${results.length}`);
  return results;
}

// ── Resumable upload helpers ──────────────────────────────────────────────────

/**
 * Build the Drive folder hierarchy for a structured upload and return the leaf
 * (content-type) folder ID.  Creates any missing folders along the way.
 *
 * Path: root / Clients / clientFolderName / year / MM-MonthName / contentType
 */
export async function createFolderHierarchy(
  clientFolderName: string,
  contentType: string,
  monthKey: string,
): Promise<{ monthFolderId: string; clientFolderName: string }> {
  console.log(JSON.stringify({
    step: 'createFolderHierarchy_entry',
    clientFolderName, contentType, monthKey,
  }));
  const { drive, rootFolderId } = getDriveClient();
  const { year, monthFolder } = monthKeyToComponents(monthKey);

  const clientsFolderId = await getOrCreateFolder(drive, 'Clients', rootFolderId);
  console.log('[google-drive] folder hierarchy — Clients →', clientsFolderId);

  const clientFolderId = await getOrCreateFolder(drive, clientFolderName, clientsFolderId);
  console.log('[google-drive] folder hierarchy — client:', clientFolderName, '→', clientFolderId);

  const yearFolderId = await getOrCreateFolder(drive, year, clientFolderId);
  console.log('[google-drive] folder hierarchy — year:', year, '→', yearFolderId);

  const monthFolderIdRaw = await getOrCreateFolder(drive, monthFolder, yearFolderId);
  console.log('[google-drive] folder hierarchy — month:', monthFolder, '→', monthFolderIdRaw);

  const contentTypeFolderId = await getOrCreateFolder(drive, contentType, monthFolderIdRaw);
  console.log('[google-drive] folder hierarchy — contentType:', contentType, '→', contentTypeFolderId);

  console.log(JSON.stringify({
    step: 'createFolderHierarchy_complete',
    monthFolderId: contentTypeFolderId, clientFolderName,
  }));

  return { monthFolderId: contentTypeFolderId, clientFolderName };
}

/**
 * Initiate a Google Drive resumable upload session.
 *
 * Calls POST https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable
 * with the OAuth access token from the server's credential store.
 *
 * Returns the upload URL from the Location response header.  The caller
 * (typically the browser) can then PUT file data directly to that URL in
 * one or more chunks without exposing OAuth credentials.
 */
export async function initiateResumableSession(
  fileName: string,
  fileType: string,
  fileSize: number,
  monthFolderId: string,
): Promise<string> {
  console.log(JSON.stringify({
    step: 'initiateResumableSession_entry',
    fileName, fileType, fileSize, monthFolderId,
  }));
  const { auth } = getDriveClient();
  console.log('[google-drive] initiateResumableSession — auth.credentials present:', !!(auth.credentials));
  console.log('[google-drive] initiateResumableSession — refresh_token set:', !!(auth.credentials?.refresh_token));

  // Obtain a short-lived access token via the OAuth2 refresh token
  let accessToken: string | null | undefined;
  try {
    const tokenResponse = await auth.getAccessToken();
    accessToken = tokenResponse?.token;
  } catch (tokenErr: unknown) {
    const tokenMsg = tokenErr instanceof Error ? tokenErr.message : String(tokenErr);
    const tokenStack = tokenErr instanceof Error ? (tokenErr.stack ?? null) : null;
    console.error(JSON.stringify({
      step: 'get_access_token_failed',
      error: { message: tokenMsg, stack: tokenStack },
    }));
    throw tokenErr;
  }
  if (!accessToken) {
    throw new Error('Failed to obtain Google OAuth access token for resumable session');
  }

  console.log('[google-drive] access_token present:', !!accessToken, '| token length:', accessToken ? accessToken.length : 0);
  console.log(JSON.stringify({
    step: 'initiate_resumable_session_request',
    fileName, fileType, fileSize, monthFolderId,
    url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',
    fileMetadata: { name: fileName, parents: [monthFolderId] },
  }));

  const initRes = await fetch(
    // supportsAllDrives=true is required when the target folder lives in a
    // Shared Drive; harmless for My Drive.
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        // Required by the Drive resumable-upload protocol so Google can
        // correctly negotiate the upload session for browser clients.
        'X-Upload-Content-Type': fileType,
        'X-Upload-Content-Length': String(fileSize),
      },
      body: JSON.stringify({ name: fileName, parents: [monthFolderId] }),
    },
  );

  console.log(JSON.stringify({
    step: 'initiate_resumable_session_response',
    httpStatus: initRes.status,
    ok: initRes.ok,
    hasLocationHeader: !!initRes.headers.get('Location'),
  }));

  if (!initRes.ok) {
    const body = await initRes.text();
    console.error(JSON.stringify({
      step: 'initiate_resumable_session_failed',
      httpStatus: initRes.status,
      responseBody: body.slice(0, 600),
    }));
    throw new Error(`Resumable session initiation failed (${initRes.status}): ${body}`);
  }

  const uploadUrl = initRes.headers.get('Location');
  if (!uploadUrl) {
    throw new Error('Resumable session initiation did not return a Location header');
  }

  console.log('[google-drive] resumable session created successfully — uploadUrl present: true');
  return uploadUrl;
}

/**
 * After the browser has finished uploading a file directly to Google Drive,
 * grant public read access and return the canonical view / download URLs.
 */
export async function finalizeFileAfterUpload(
  driveFileId: string,
): Promise<{ webViewLink: string; webContentLink: string; thumbnailLink: string | null; mimeType: string | null }> {
  const { drive } = getDriveClient();

  // Grant anyone-with-link read access
  await drive.permissions.create({
    fileId: driveFileId,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: true,
  });
  console.log('[google-drive] public read permission granted for file:', driveFileId);

  // Fetch updated metadata
  const metaRes = await drive.files.get({
    fileId: driveFileId,
    fields: 'id,mimeType,webViewLink,webContentLink,thumbnailLink',
    supportsAllDrives: true,
  });

  const rawView = metaRes.data.webViewLink ?? '';
  const rawDownload = metaRes.data.webContentLink ?? '';

  let webViewLink = rawView;
  try { assertValidUrl(rawView, 'webViewLink'); } catch (e) {
    console.warn('[google-drive] webViewLink from Drive is not a valid URL — using fallback:', (e as Error).message);
    webViewLink = `https://drive.google.com/file/d/${driveFileId}/view`;
  }

  let webContentLink = rawDownload;
  try { assertValidUrl(rawDownload, 'webContentLink'); } catch (e) {
    console.warn('[google-drive] webContentLink from Drive is not a valid URL — using fallback:', (e as Error).message);
    webContentLink = `https://drive.google.com/uc?id=${driveFileId}&export=download`;
  }

  const thumbnailLink = metaRes.data.thumbnailLink ?? null;
  const mimeType = metaRes.data.mimeType ?? null;

  console.log('[google-drive] finalized file:', driveFileId, '| view:', webViewLink);
  return { webViewLink, webContentLink, thumbnailLink, mimeType };
}
