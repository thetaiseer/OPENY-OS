/**
 * Server-only Google Drive utility.
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

  // Always extract the bare folder ID, even if a full URL was stored in env
  const folderId = extractDriveId(rawFolderId);
  console.log('[google-drive] init — folder_id (after extractDriveId):', folderId);

  const auth = new google.auth.JWT(
    process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
    null,
    process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/drive']
  );

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
  });

  const newId = createRes.data.id;
  if (!newId) throw new Error(`Failed to create Drive folder: ${name}`);
  console.log(`[google-drive] created folder "${name}" — id:`, newId);
  return newId;
}

// ── Main upload function ──────────────────────────────────────────────────────

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

  // Validate content type (case-insensitive match against ALLOWED_CONTENT_TYPES)
  const rawContentType = options.contentType?.trim() ?? '';
  const contentType = rawContentType.toUpperCase();
  if (contentType && !(ALLOWED_CONTENT_TYPES as readonly string[]).includes(contentType)) {
    throw new Error(
      `Failed while validating content_type: "${rawContentType}" is not one of: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
    );
  }
  console.log(`[google-drive] structured upload: ${clientFolderName}/${contentType}/${monthKey}/${fileName}`);

  // Build folder hierarchy: root → client → content_type → month
  const clientFolderId = await getOrCreateFolder(drive, clientFolderName, rootFolderId);
  const contentTypeFolderId = await getOrCreateFolder(drive, contentType, clientFolderId);
  const monthFolderId = await getOrCreateFolder(drive, monthKey, contentTypeFolderId);

  // ── Stage 1: create/find client folder ────────────────────────────────────
  let parentId = rootFolderId;
  let clientFolderName: string | null = null;

  if (options.clientName?.trim()) {
    console.log('[upload] ══ STAGE: create/find client folder ══════════════════');
    try {
      clientFolderName = normalizeFolderName(options.clientName);
      parentId = await findOrCreateFolder(drive, options.clientName, rootFolderId);
      folderPathParts.push(clientFolderName);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed while creating client folder: ${msg}`);
    }
  }
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

  const driveFolderId = parentId;
  const folderPath = folderPathParts.join(' / ');
  console.log('[google-drive] generated folder path:', folderPath);
  console.log('[google-drive] target folder ID for file upload:', parentId);
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
    webViewLink,
    webContentLink,
  };

  console.log('[google-drive] final links — webViewLink:', result.webViewLink);
  console.log('[google-drive] final links — webContentLink:', result.webContentLink);

  return { drive_file_id: fileId, drive_folder_id: driveFolderId, client_folder_name: clientFolderName, webViewLink, webContentLink, folderPath };
  return result;
}

// ── Delete ────────────────────────────────────────────────────────────────────

/**
 * Delete a file from Google Drive by its file ID.
 * Throws on failure so the caller can surface the exact error.
 */
export async function deleteFromDrive(fileId: string): Promise<void> {
  const { drive } = getDriveClient();
  await drive.files.delete({ fileId });
}
