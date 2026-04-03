/**
 * Server-only Google Drive utility.
 * Never import this file from client components.
 */
import { google } from 'googleapis';
import type { drive_v3 } from 'googleapis';
import { Readable } from 'stream';
import { clientToFolderName } from './asset-utils';

// ── Allowed content types ──────────────────────────────────────────────────────
export const ALLOWED_CONTENT_TYPES = ['design', 'video', 'photo', 'document', 'audio', 'other'] as const;
export type AllowedContentType = typeof ALLOWED_CONTENT_TYPES[number];

// ── Result / options types ────────────────────────────────────────────────────
export interface DriveUploadResult {
  drive_file_id: string;
  drive_folder_id: string;
  webViewLink: string;
  webContentLink: string;
  folderPath: string;
}

export interface UploadOptions {
  /** Raw client name — will be normalized to UPPER_SNAKE_CASE */
  clientName?: string;
  /** One of ALLOWED_CONTENT_TYPES */
  contentType?: string;
  /** YYYY-MM format */
  month?: string;
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
 * THIS IS THE PRIMARY FIX: if GOOGLE_DRIVE_FOLDER_ID is set to a full URL,
 * the raw value contains slashes which break gaxios URL construction and
 * produce "The string did not match the expected pattern." at runtime.
 */
export function extractDriveId(value: string): string {
  if (!value || !value.trim()) {
    throw new Error('extractDriveId: received empty or whitespace-only string');
  }
  const trimmed = value.trim();

  // Patterns that embed the ID in a URL path or query string
  const urlPatterns: RegExp[] = [
    /\/folders\/([a-zA-Z0-9_-]+)/,   // /folders/ID
    /\/file\/d\/([a-zA-Z0-9_-]+)/,   // /file/d/ID/view
    /[?&]id=([a-zA-Z0-9_-]+)/,       // ?id=ID  or  &id=ID
  ];

  for (const pattern of urlPatterns) {
    const m = trimmed.match(pattern);
    if (m?.[1]) {
      console.log('[google-drive] extractDriveId: extracted raw ID', m[1], 'from URL value');
      return m[1];
    }
  }

  // Assume already a raw folder/file ID
  console.log('[google-drive] extractDriveId: value appears to be a raw ID:', trimmed);
  return trimmed;
}

/**
 * Sanitize a file name: remove chars that are problematic in Google Drive
 * or in path construction.
 */
export function sanitizeFileName(name: string): string {
  return name
    .trim()
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 255);
}

/**
 * Normalize a folder name to UPPER_SNAKE_CASE, stripping special characters.
 */
export function normalizeFolderName(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s_-]/g, '')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 100);
}

/**
 * Return true if the string is a valid YYYY-MM month.
 */
export function validateMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
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

// ── Drive client factory ──────────────────────────────────────────────────────

function getDriveClient() {
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const rawKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY;
  const privateKey = rawKey?.replace(/\\n/g, '\n');
  const rawFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  console.log('[google-drive] init — client_email:', clientEmail ?? '(missing)');
  console.log('[google-drive] init — private_key present:', !!privateKey, '| length:', privateKey?.length ?? 0);
  console.log('[google-drive] init — GOOGLE_DRIVE_FOLDER_ID raw value:', rawFolderId ?? '(missing)');

  if (!clientEmail || !privateKey || !rawFolderId) {
    throw new Error(
      'Missing Google Drive env vars: GOOGLE_DRIVE_CLIENT_EMAIL, GOOGLE_DRIVE_PRIVATE_KEY, GOOGLE_DRIVE_FOLDER_ID',
    );
  }

  // THE FIX: always extract the bare folder ID, even if a full URL was stored in env
  const folderId = extractDriveId(rawFolderId);
  console.log('[google-drive] init — folder_id (after extractDriveId):', folderId);

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  console.log('[google-drive] GoogleAuth created successfully');
  return { drive: google.drive({ version: 'v3', auth }), rootFolderId: folderId };
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

/**
 * Find an existing folder by name under parentId, or create it if absent.
 * Returns the folder's Drive ID.
 */
async function getOrCreateFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId: string,
): Promise<string> {
  // Search for an existing folder with this exact name under the parent
  const safeName = escapeDriveQueryString(name);
  const searchRes = await drive.files.list({
    q: `name='${safeName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id,name)',
    spaces: 'drive',
  });

  const existing = searchRes.data.files?.[0];
  if (existing?.id) {
    console.log(`[google-drive] folder "${name}" already exists — id:`, existing.id);
    return existing.id;
  }

  // Create the folder
  const createRes = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
  });

  const newId = createRes.data.id;
  if (!newId) throw new Error(`Failed to create Drive folder: ${name}`);
  console.log(`[google-drive] created folder "${name}" — id:`, newId);
  return newId;
}

/**
 * Upload a file buffer to the structured path:
 *   OPENY_OS_STORAGE / CLIENT_FOLDER_NAME / CONTENT_TYPE / MONTH_KEY
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

  console.log(`[google-drive] structured upload: ${clientFolderName}/${contentType}/${monthKey}/${fileName}`);

  // Build folder hierarchy: root → client → content_type → month
  const clientFolderId = await getOrCreateFolder(drive, clientFolderName, rootFolderId);
  const contentTypeFolderId = await getOrCreateFolder(drive, contentType, clientFolderId);
  const monthFolderId = await getOrCreateFolder(drive, monthKey, contentTypeFolderId);

  // Upload file into the month folder
  const readableStream = Readable.from(buffer);
  console.log('[google-drive] uploading file:', fileName, '| mimeType:', mimeType, '| size (bytes):', buffer.length);

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
  });

  console.log('[google-drive] create response status:', createRes.status);

  const fileId = createRes.data.id;
  if (!fileId) {
    throw new Error('Google Drive upload succeeded but returned no file ID');
  }

  console.log('[google-drive] file ID:', fileId);

  // Grant anyone-with-link read access
  const permRes = await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
  });
  console.log('[google-drive] permission create status:', permRes.status);

  // Fetch updated links after permission change
  const metaRes = await drive.files.get({
    fileId,
    fields: 'id,webViewLink,webContentLink',
  });

  const result: DriveUploadResult = {
    drive_file_id: fileId,
    drive_folder_id: monthFolderId,
    webViewLink: metaRes.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`,
    webContentLink:
      metaRes.data.webContentLink ??
      `https://drive.google.com/uc?id=${fileId}&export=download`,
  };

  console.log('[google-drive] final links — webViewLink:', result.webViewLink);
  console.log('[google-drive] final links — webContentLink:', result.webContentLink);

  return result;
}

// ── Folder helpers ────────────────────────────────────────────────────────────

type DriveClient = ReturnType<typeof google.drive>;

/**
 * Upload a file buffer to Google Drive and make it publicly readable.
 * Uses the root folder from env (legacy — prefer uploadToStructuredPath).
 * Returns drive_file_id, webViewLink, webContentLink.
 */
export async function uploadToDrive(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<Omit<DriveUploadResult, 'drive_folder_id'>> {
  const { drive, rootFolderId } = getDriveClient();
 * Find an existing subfolder by name under parentId, or create it.
 * Returns the subfolder ID.
 */
async function findOrCreateFolder(
  drive: DriveClient,
  folderName: string,
  parentId: string,
): Promise<string> {
  const safeName = normalizeFolderName(folderName);
  if (!safeName) {
    throw new Error(
      `findOrCreateFolder: folder name "${folderName}" normalizes to an empty string — cannot create folder`,
    );
  }

  console.log(`[google-drive] findOrCreateFolder — name="${safeName}" parent="${parentId}"`);

  console.log('[google-drive] uploading file:', fileName, '| mimeType:', mimeType, '| size (bytes):', buffer.length);
  console.log('[google-drive] target folder_id:', rootFolderId);

  const createRes = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [rootFolderId],
    },
    media: {
      mimeType,
      body: readableStream,
  // Escape single quotes for the Drive query
  const escapedName = safeName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  const listRes = await drive.files.list({
    q: `name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  const existing = listRes.data.files?.[0];
  if (existing?.id) {
    console.log(`[google-drive] findOrCreateFolder — found existing id: ${existing.id}`);
    return existing.id;
  }

  const createRes = await drive.files.create({
    requestBody: {
      name: safeName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
  });

  const newId = createRes.data.id;
  if (!newId) {
    throw new Error(`Drive created folder "${safeName}" but returned no ID`);
  }
  console.log(`[google-drive] findOrCreateFolder — created new id: ${newId}`);
  return newId;
}

// ── Main upload function ──────────────────────────────────────────────────────

/**
 * Upload a file buffer to Google Drive inside an organized subfolder hierarchy:
 *   ROOT / [CLIENT_NAME] / [CONTENT_TYPE] / YYYY-MM / file
 *
 * Each stage has its own try/catch and throws with the exact stage name on failure.
 */
export async function uploadToDrive(
  buffer: Buffer,
  mimeType: string,
  rawFileName: string,
  options: UploadOptions = {},
): Promise<DriveUploadResult> {
  const { drive, folderId: rootFolderId } = getDriveClient();

  const fileName = sanitizeFileName(rawFileName);

  console.log('[upload] ══ STAGE: resolve inputs ══════════════════════════════');
  console.log('[google-drive] file name (raw):', rawFileName, '→ sanitized:', fileName);
  console.log('[google-drive] mimeType:', mimeType);
  console.log('[google-drive] buffer size (bytes):', buffer.length);
  console.log('[google-drive] options.clientName:', options.clientName ?? '(none)');
  console.log('[google-drive] options.contentType:', options.contentType ?? '(none)');
  console.log('[google-drive] options.month:', options.month ?? '(none)');
  console.log('[google-drive] root folder ID:', rootFolderId);

  // Validate and normalise month
  const month = options.month?.trim() || new Date().toISOString().slice(0, 7);
  if (!validateMonth(month)) {
    throw new Error(
      `Failed while validating month: "${month}" is not YYYY-MM format`,
    );
  }

  // Validate content type
  const contentType = options.contentType?.trim().toLowerCase() ?? '';
  if (contentType && !(ALLOWED_CONTENT_TYPES as readonly string[]).includes(contentType)) {
    throw new Error(
      `Failed while validating content_type: "${contentType}" is not one of: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
    );
  }

  const folderPathParts: string[] = ['(root)'];

  // ── Stage 1: create/find client folder ────────────────────────────────────
  let parentId = rootFolderId;

  if (options.clientName?.trim()) {
    console.log('[upload] ══ STAGE: create/find client folder ══════════════════');
    try {
      parentId = await findOrCreateFolder(drive, options.clientName, rootFolderId);
      folderPathParts.push(normalizeFolderName(options.clientName));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed while creating client folder: ${msg}`);
    }
  }

  // ── Stage 2: create/find content type folder ──────────────────────────────
  if (contentType) {
    console.log('[upload] ══ STAGE: create/find content type folder ═══════════');
    try {
      parentId = await findOrCreateFolder(drive, contentType, parentId);
      folderPathParts.push(normalizeFolderName(contentType));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed while creating content type folder: ${msg}`);
    }
  }

  // ── Stage 3: create/find month folder ─────────────────────────────────────
  console.log('[upload] ══ STAGE: create/find month folder ═════════════════════');
  try {
    parentId = await findOrCreateFolder(drive, month, parentId);
    folderPathParts.push(month);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed while creating month folder: ${msg}`);
  }

  const folderPath = folderPathParts.join(' / ');
  console.log('[google-drive] generated folder path:', folderPath);
  console.log('[google-drive] target folder ID for file upload:', parentId);

  // ── Stage 4: upload file ───────────────────────────────────────────────────
  console.log('[upload] ══ STAGE: upload file ══════════════════════════════════');
  let fileId: string;
  try {
    const readableStream = Readable.from(buffer);

    const createRes = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [parentId],
      },
      media: {
        mimeType,
        body: readableStream,
      },
      fields: 'id,webViewLink,webContentLink',
    });

    console.log('[google-drive] upload response status:', createRes.status);
    console.log('[google-drive] upload response data:', JSON.stringify(createRes.data));

    const id = createRes.data.id;
    if (!id) throw new Error('Drive returned no file ID after upload');
    fileId = id;
    console.log('[google-drive] uploaded file ID:', fileId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed while uploading file to Google Drive: ${msg}`);
  }

  // ── Stage 5: create public permission ─────────────────────────────────────
  console.log('[upload] ══ STAGE: create permission ════════════════════════════');
  try {
    const permRes = await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
    });
    console.log('[google-drive] permission create status:', permRes.status);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed while creating public permission: ${msg}`);
  }

  // ── Stage 6: get file links ────────────────────────────────────────────────
  console.log('[upload] ══ STAGE: get file links ════════════════════════════════');
  let webViewLink: string;
  let webContentLink: string;
  try {
    const metaRes = await drive.files.get({
      fileId,
      fields: 'id,webViewLink,webContentLink',
    });

    // Use API values, but fall back to constructed URLs if they are missing or invalid
    const rawView = metaRes.data.webViewLink ?? '';
    const rawDownload = metaRes.data.webContentLink ?? '';

    webViewLink = rawView;
    try {
      assertValidUrl(rawView, 'webViewLink');
    } catch {
      webViewLink = `https://drive.google.com/file/d/${fileId}/view`;
      console.warn('[google-drive] webViewLink from API was invalid — using fallback:', webViewLink);
    }

    webContentLink = rawDownload;
    try {
      assertValidUrl(rawDownload, 'webContentLink');
    } catch {
      webContentLink = `https://drive.google.com/uc?id=${fileId}&export=download`;
      console.warn('[google-drive] webContentLink from API was invalid — using fallback:', webContentLink);
    }

    console.log('[google-drive] final webViewLink:', webViewLink);
    console.log('[google-drive] final webContentLink:', webContentLink);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed while generating Google Drive URLs: ${msg}`);
  }

  return { drive_file_id: fileId, webViewLink, webContentLink, folderPath };
}

/**
 * Delete a file from Google Drive by its file ID.
 * Throws on failure so the caller can surface the exact error.
 */
export async function deleteFromDrive(fileId: string): Promise<void> {
  const { drive } = getDriveClient();
  await drive.files.delete({ fileId });
}

