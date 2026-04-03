/**
 * Server-only Google Drive utility.
 * Uses Google OAuth 2.0 user-based authentication (not a service account).
 * Never import this file from client components.
 */
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
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

// ── Drive client factory (Google OAuth 2.0 user-based) ───────────────────────

/**
 * Build a Drive client authenticated as the Google user who completed the
 * OAuth 2.0 consent flow.  Credentials are supplied via env vars:
 *   GOOGLE_OAUTH_CLIENT_ID      – OAuth 2.0 client ID
 *   GOOGLE_OAUTH_CLIENT_SECRET  – OAuth 2.0 client secret
 *   GOOGLE_OAUTH_REFRESH_TOKEN  – refresh token obtained after the first login
 *   GOOGLE_DRIVE_FOLDER_ID      – root Drive folder ID (or full URL)
 *
 * To obtain the refresh token, visit /api/auth/google in your browser and
 * complete the Google consent screen, then copy the refresh token shown into
 * your GOOGLE_OAUTH_REFRESH_TOKEN env var.
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
    throw new Error(
      'Missing env var: GOOGLE_OAUTH_REFRESH_TOKEN — visit /api/auth/google to authorize your Google account',
    );
  }
  if (!rawFolderId) {
    throw new Error('Missing env var: GOOGLE_DRIVE_FOLDER_ID');
  }

  // Always extract the bare folder ID, even if a full URL was stored in env
  const folderId = extractDriveId(rawFolderId);
  console.log('[google-drive] init — folder_id (after extractDriveId):', folderId);

  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });

  // Propagate any new access tokens (auto-refresh) so callers can log them
  auth.on('tokens', (tokens) => {
    if (tokens.refresh_token) {
      console.log('[google-drive] ⚠ New refresh token issued — update GOOGLE_OAUTH_REFRESH_TOKEN env var:', tokens.refresh_token);
    }
    console.log('[google-drive] Access token refreshed successfully');
  });

  console.log('[google-drive] OAuth2 client created successfully');
  return { drive: google.drive({ version: 'v3', auth }), rootFolderId: folderId, auth };
}

/**
 * Return the email address of the Google account that owns the OAuth token.
 * Used for debug logging only; failures are non-fatal.
 */
async function getAuthenticatedEmail(auth: OAuth2Client): Promise<string> {
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth });
    const res = await oauth2.userinfo.get();
    return res.data.email ?? '(unknown)';
  } catch {
    return '(could not retrieve — check OAuth scopes)';
  }
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
  const { drive, rootFolderId, auth } = getDriveClient();

  // Log the authenticated Google account email
  const email = await getAuthenticatedEmail(auth);
  console.log('[google-drive] authenticated as Google account:', email);

  console.log(`[google-drive] structured upload: ${clientFolderName}/${contentType}/${monthKey}/${fileName}`);

  // Build folder hierarchy: root → client → content_type → month
  const clientFolderId = await getOrCreateFolder(drive, clientFolderName, rootFolderId);
  console.log('[google-drive] resolved client folder:', clientFolderName, '→ id:', clientFolderId);

  const contentTypeFolderId = await getOrCreateFolder(drive, contentType, clientFolderId);
  console.log('[google-drive] resolved content type folder:', contentType, '→ id:', contentTypeFolderId);

  const monthFolderId = await getOrCreateFolder(drive, monthKey, contentTypeFolderId);
  console.log('[google-drive] resolved month folder:', monthKey, '→ id:', monthFolderId);

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

/**
 * Delete a file from Google Drive by its file ID.
 * Throws on failure so the caller can surface the exact error.
 */
export async function deleteFromDrive(fileId: string): Promise<void> {
  const { drive } = getDriveClient();
  await drive.files.delete({ fileId, supportsAllDrives: true });
}

// ── Resumable upload helpers ──────────────────────────────────────────────────

/**
 * Build the Drive folder hierarchy for a structured upload and return the leaf
 * (month) folder ID.  Creates any missing folders along the way.
 *
 * Path: OPENY_OS_STORAGE / clientFolderName / contentType / monthKey
 */
export async function createFolderHierarchy(
  clientFolderName: string,
  contentType: string,
  monthKey: string,
): Promise<{ monthFolderId: string; clientFolderName: string }> {
  const { drive, rootFolderId } = getDriveClient();

  const clientFolderId = await getOrCreateFolder(drive, clientFolderName, rootFolderId);
  console.log('[google-drive] folder hierarchy — client:', clientFolderName, '→', clientFolderId);

  const contentTypeFolderId = await getOrCreateFolder(drive, contentType, clientFolderId);
  console.log('[google-drive] folder hierarchy — contentType:', contentType, '→', contentTypeFolderId);

  const monthFolderId = await getOrCreateFolder(drive, monthKey, contentTypeFolderId);
  console.log('[google-drive] folder hierarchy — month:', monthKey, '→', monthFolderId);

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

  const tokenResponse = await auth.getAccessToken();
  const accessToken = tokenResponse?.token;
  if (!accessToken) {
    throw new Error('Failed to obtain Google OAuth access token for resumable session');
  }

  console.log('[google-drive] initiating resumable session — file:', fileName, '| size:', fileSize, '| folder:', monthFolderId);

  const initRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': fileType,
        'X-Upload-Content-Length': String(fileSize),
      },
      body: JSON.stringify({ name: fileName, parents: [monthFolderId] }),
    },
  );

  if (!initRes.ok) {
    const body = await initRes.text();
    throw new Error(`Resumable session initiation failed (${initRes.status}): ${body}`);
  }

  const uploadUrl = initRes.headers.get('Location');
  if (!uploadUrl) {
    throw new Error('Resumable session initiation did not return a Location header');
  }

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
  try { assertValidUrl(rawView, 'webViewLink'); } catch {
    webViewLink = `https://drive.google.com/file/d/${driveFileId}/view`;
  }

  let webContentLink = rawDownload;
  try { assertValidUrl(rawDownload, 'webContentLink'); } catch {
    webContentLink = `https://drive.google.com/uc?id=${driveFileId}&export=download`;
  }

  console.log('[google-drive] finalized file:', driveFileId, '| view:', webViewLink);
  return { webViewLink, webContentLink };
}
