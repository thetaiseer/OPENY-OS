/**
 * Server-only Google Drive utility.
 * Uses a Google Service Account (JWT) — no user OAuth required.
 * Never import this file from client components.
 */
import { google } from 'googleapis';
import type { drive_v3 } from 'googleapis';
import { Readable } from 'stream';
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

// ── Drive client factory (Google Service Account / JWT) ───────────────────────

/**
 * Build a Drive client authenticated as a Google Service Account.
 * Credentials are supplied via env vars:
 *   GOOGLE_DRIVE_CLIENT_EMAIL        – service account email
 *   GOOGLE_DRIVE_PRIVATE_KEY_BASE64  – Base64-encoded PEM private key
 *   GOOGLE_DRIVE_FOLDER_ID           – root Drive folder ID (or full URL)
 */
function getDriveClient() {
  const clientEmail     = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const privateKeyB64   = process.env.GOOGLE_DRIVE_PRIVATE_KEY_BASE64;
  const rawFolderId     = process.env.GOOGLE_DRIVE_FOLDER_ID;

  console.log('[google-drive] init — GOOGLE_DRIVE_CLIENT_EMAIL present:', !!clientEmail);
  console.log('[google-drive] init — GOOGLE_DRIVE_PRIVATE_KEY_BASE64 present:', !!privateKeyB64);
  console.log('[google-drive] init — GOOGLE_DRIVE_FOLDER_ID raw value:', rawFolderId ?? '(missing)');

  if (!clientEmail) {
    throw new Error('Missing env var: GOOGLE_DRIVE_CLIENT_EMAIL');
  }
  if (!privateKeyB64) {
    throw new Error('Missing env var: GOOGLE_DRIVE_PRIVATE_KEY_BASE64');
  }
  if (!rawFolderId) {
    throw new Error('Missing env var: GOOGLE_DRIVE_FOLDER_ID');
  }

  // Always extract the bare folder ID, even if a full URL was stored in env
  const folderId = extractDriveId(rawFolderId);
  console.log('[google-drive] init — folder_id (after extractDriveId):', folderId);

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: Buffer.from(privateKeyB64, 'base64').toString('utf-8'),
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  console.log('[google-drive] Service Account JWT client created successfully');
  return { drive: google.drive({ version: 'v3', auth }), rootFolderId: folderId, auth };
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

// ── Main upload function ──────────────────────────────────────────────────────

/**
 * Upload a file buffer to the structured path:
 *   root / Clients / clientFolderName / contentType / year / MM-MonthName
 *
 * Creates any missing folders along the way.
 * Returns drive_file_id, drive_folder_id (the month folder), and public links.
 */
export async function uploadToStructuredPath(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
  clientFolderName: string,
  contentType: string,
  monthKey: string,
): Promise<DriveUploadResult> {
  const { drive, rootFolderId } = getDriveClient();

  const { year, monthFolder } = monthKeyToComponents(monthKey);
  console.log(`[google-drive] structured upload: Clients/${clientFolderName}/${contentType}/${year}/${monthFolder}/${fileName}`);

  // Build folder hierarchy: root → Clients → client → content_type → year → month
  const clientsFolderId = await getOrCreateFolder(drive, 'Clients', rootFolderId);
  console.log('[google-drive] resolved Clients folder → id:', clientsFolderId);

  const clientFolderId = await getOrCreateFolder(drive, clientFolderName, clientsFolderId);
  console.log('[google-drive] resolved client folder:', clientFolderName, '→ id:', clientFolderId);

  const contentTypeFolderId = await getOrCreateFolder(drive, contentType, clientFolderId);
  console.log('[google-drive] resolved content type folder:', contentType, '→ id:', contentTypeFolderId);

  const yearFolderId = await getOrCreateFolder(drive, year, contentTypeFolderId);
  console.log('[google-drive] resolved year folder:', year, '→ id:', yearFolderId);

  const monthFolderId = await getOrCreateFolder(drive, monthFolder, yearFolderId);
  console.log('[google-drive] resolved month folder:', monthFolder, '→ id:', monthFolderId);

  // Upload file into the month folder
  const readableStream = Readable.from(buffer);
  console.log('[google-drive] uploading file:', fileName, '| mimeType:', mimeType, '| size (bytes):', buffer.length, '| monthFolderId:', monthFolderId);

  const createRes = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [monthFolderId],
    },
    media: {
      mimeType,
      body: readableStream,
    },
    fields: 'id,webViewLink,webContentLink',
    supportsAllDrives: true,
  });

  console.log('[google-drive] create response status:', createRes.status);
  console.log('[google-drive] create response data:', JSON.stringify(createRes.data));

  const fileId = createRes.data.id;
  if (!fileId) {
    throw new Error('Google Drive upload succeeded but returned no file ID');
  }
  console.log('[google-drive] file ID:', fileId);

  // Grant anyone-with-link read access
  const permRes = await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
    supportsAllDrives: true,
  });
  console.log('[google-drive] permission create status:', permRes.status);

  // Fetch updated links after permission change
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

  const result: DriveUploadResult = {
    drive_file_id: fileId,
    drive_folder_id: monthFolderId,
    client_folder_name: clientFolderName,
    webViewLink,
    webContentLink,
  };

  console.log('[google-drive] uploaded file id:', fileId, '| webViewLink:', webViewLink);
  console.log('[google-drive] final links — webViewLink:', result.webViewLink);
  console.log('[google-drive] final links — webContentLink:', result.webContentLink);

  return result;
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

// ── Resumable upload helpers ──────────────────────────────────────────────────

/**
 * Build the Drive folder hierarchy for a structured upload and return the leaf
 * (month) folder ID.  Creates any missing folders along the way.
 *
 * Path: root / Clients / clientFolderName / contentType / year / MM-MonthName
 */
export async function createFolderHierarchy(
  clientFolderName: string,
  contentType: string,
  monthKey: string,
): Promise<{ monthFolderId: string; clientFolderName: string }> {
  const { drive, rootFolderId } = getDriveClient();
  const { year, monthFolder } = monthKeyToComponents(monthKey);

  const clientsFolderId = await getOrCreateFolder(drive, 'Clients', rootFolderId);
  console.log('[google-drive] folder hierarchy — Clients →', clientsFolderId);

  const clientFolderId = await getOrCreateFolder(drive, clientFolderName, clientsFolderId);
  console.log('[google-drive] folder hierarchy — client:', clientFolderName, '→', clientFolderId);

  const contentTypeFolderId = await getOrCreateFolder(drive, contentType, clientFolderId);
  console.log('[google-drive] folder hierarchy — contentType:', contentType, '→', contentTypeFolderId);

  const yearFolderId = await getOrCreateFolder(drive, year, contentTypeFolderId);
  console.log('[google-drive] folder hierarchy — year:', year, '→', yearFolderId);

  const monthFolderId = await getOrCreateFolder(drive, monthFolder, yearFolderId);
  console.log('[google-drive] folder hierarchy — month:', monthFolder, '→', monthFolderId);

  return { monthFolderId, clientFolderName };
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
  const { auth } = getDriveClient();

  // Obtain a short-lived access token from the service account JWT
  const tokenResponse = await auth.getAccessToken();
  const accessToken = tokenResponse?.token;
  if (!accessToken) {
    throw new Error('Failed to obtain Google service account access token for resumable session');
  }

  console.log('[google-drive] access_token present:', !!accessToken);
  console.log('[google-drive] initiating resumable session — file:', fileName);
  console.log('[google-drive] mimeType:', fileType, '| fileSize:', fileSize, '| folder:', monthFolderId);

  const initRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: fileName, parents: [monthFolderId] }),
    },
  );

  if (!initRes.ok) {
    const body = await initRes.text();
    console.error('[google-drive] resumable session initiation failed — status:', initRes.status, '| body:', body);
    throw new Error(`Resumable session initiation failed (${initRes.status}): ${body}`);
  }

  const uploadUrl = initRes.headers.get('Location');
  if (!uploadUrl) {
    throw new Error('Resumable session initiation did not return a Location header');
  }

  console.log('[google-drive] upload_url obtained successfully');
  console.log('[google-drive] resumable session created successfully');
  return uploadUrl;
}

/**
 * After the browser has finished uploading a file directly to Google Drive,
 * grant public read access and return the canonical view / download URLs.
 */
export async function finalizeFileAfterUpload(
  driveFileId: string,
): Promise<{ webViewLink: string; webContentLink: string }> {
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
    fields: 'id,webViewLink,webContentLink',
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

  console.log('[google-drive] finalized file:', driveFileId, '| view:', webViewLink);
  return { webViewLink, webContentLink };
}
