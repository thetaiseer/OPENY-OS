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
import { createClient } from '@supabase/supabase-js';

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

/**
 * Thrown when Google rejects the stored OAuth credentials
 * (e.g. unauthorized_client, invalid_grant, token revoked).
 * Callers should surface "Google Drive must be reconnected" to the user.
 */
export class DriveAuthError extends Error {
  constructor(detail: string) {
    super(`Google Drive must be reconnected: ${detail}`);
    this.name = 'DriveAuthError';
  }
}

// ── Supabase token storage ────────────────────────────────────────────────────

/** Return a service-role Supabase client, or null if env vars are missing. */
function getSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Read the stored Google OAuth refresh token from the `google_oauth_tokens`
 * table.  Returns null if the table doesn't exist or no row is present.
 */
export async function getStoredRefreshToken(): Promise<string | null> {
  const sb = getSupabaseServiceClient();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from('google_oauth_tokens')
      .select('refresh_token')
      .eq('key', 'default')
      .maybeSingle();
    if (error || !data) return null;
    return (data as { refresh_token: string }).refresh_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Persist (upsert) a Google OAuth refresh token into `google_oauth_tokens`.
 * Silently fails if the table doesn't exist yet.
 */
export async function saveRefreshToken(refreshToken: string): Promise<void> {
  const sb = getSupabaseServiceClient();
  if (!sb) {
    console.warn('[google-drive] saveRefreshToken: Supabase client unavailable — token not persisted');
    return;
  }
  try {
    const { error } = await sb
      .from('google_oauth_tokens')
      .upsert({ key: 'default', refresh_token: refreshToken });
    if (error) {
      console.error('[google-drive] saveRefreshToken: upsert failed', error.message);
    } else {
      console.log('[google-drive] saveRefreshToken: refresh token saved to DB ✓');
    }
  } catch (err) {
    console.error('[google-drive] saveRefreshToken: unexpected error', err);
  }
}

/**
 * Clear the stored Google OAuth refresh token (e.g. when unauthorized_client
 * is detected and a fresh reconnect is required).
 */
export async function clearStoredRefreshToken(): Promise<void> {
  const sb = getSupabaseServiceClient();
  if (!sb) return;
  try {
    await sb.from('google_oauth_tokens').delete().eq('key', 'default');
    console.log('[google-drive] clearStoredRefreshToken: stale token cleared from DB');
  } catch (err) {
    console.error('[google-drive] clearStoredRefreshToken: error', err);
  }
}

// ── Auth-error detection ──────────────────────────────────────────────────────

/** Return true when an error from the Drive API indicates OAuth failure. */
function isAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: number | string })?.code;
  return (
    /unauthorized_client|invalid_grant|invalid_credentials|token.*(expired|revoked)|auth.*fail/i.test(msg) ||
    code === 401 ||
    code === '401'
  );
}

// ── OAuth helpers (interactive flow) ─────────────────────────────────────────

/**
 * Required env vars for the interactive Google OAuth flow.
 * (Separate from the refresh-token-based drive client vars.)
 */
const GOOGLE_OAUTH_VARS = [
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'GOOGLE_OAUTH_REDIRECT_URI',
] as const;

export interface GoogleOAuthEnvCheck {
  valid: boolean;
  missing: string[];
}

/**
 * Validate the env vars needed for the interactive OAuth flow.
 * Does not throw — returns a typed result.
 */
export function validateGoogleOAuthEnvVars(): GoogleOAuthEnvCheck {
  const missing = GOOGLE_OAUTH_VARS.filter(k => !process.env[k]);
  return { valid: missing.length === 0, missing };
}

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

/**
 * Exchange a Google OAuth authorization code for tokens.
 *
 * Calls https://oauth2.googleapis.com/token and returns the parsed token
 * response.  Throws with a descriptive message on failure.
 */
export async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri  = process.env.GOOGLE_OAUTH_REDIRECT_URI;

  if (!clientId)     throw new Error('Missing env var: GOOGLE_OAUTH_CLIENT_ID');
  if (!clientSecret) throw new Error('Missing env var: GOOGLE_OAUTH_CLIENT_SECRET');
  if (!redirectUri)  throw new Error('Missing env var: GOOGLE_OAUTH_REDIRECT_URI');

  const body = new URLSearchParams({
    code,
    client_id:     clientId,
    client_secret: clientSecret,
    redirect_uri:  redirectUri,
    grant_type:    'authorization_code',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '(no body)');
    throw new Error(`Google token endpoint returned ${res.status}: ${text}`);
  }

  const json = await res.json() as Record<string, unknown>;

  if (typeof json.error === 'string') {
    throw new Error(`Google token error: ${json.error} — ${typeof json.error_description === 'string' ? json.error_description : ''}`);
  }

  if (typeof json.access_token !== 'string') {
    throw new Error('Google token response missing access_token');
  }

  // Build a validated, strongly-typed return value
  const tokens: GoogleTokenResponse = {
    access_token:  json.access_token,
    token_type:    typeof json.token_type    === 'string' ? json.token_type    : 'Bearer',
    expires_in:    typeof json.expires_in    === 'number' ? json.expires_in    : 3600,
    scope:         typeof json.scope         === 'string' ? json.scope         : '',
    refresh_token: typeof json.refresh_token === 'string' ? json.refresh_token : undefined,
  };
  return tokens;
}

// ── Config validation ─────────────────────────────────────────────────────────

/** Granular status of the Google Drive OAuth configuration. */
export type DriveConfigStatus =
  | 'not_configured'       // No env vars are set
  | 'partially_configured' // Some but not all required env vars are set
  | 'configured'           // All env vars present; connectivity test failed for a non-auth reason
  | 'connected'            // All vars present AND a live Drive API call succeeded
  | 'auth_failed';         // All vars present but the Drive API rejected credentials

export interface DriveConfigResult {
  status: DriveConfigStatus;
  /** True only when status === 'connected'. */
  connected: boolean;
  /** Env var names that are missing/empty. */
  missingVars: string[];
  /** Human-readable error detail when status === 'auth_failed'. */
  error: string | null;
}

/**
 * Validate the Google Drive OAuth configuration and (optionally) test
 * connectivity by making a lightweight `drive.about.get` call.
 *
 * Never throws — returns a structured result instead.
 */
export async function checkDriveConnection(): Promise<DriveConfigResult> {
  const vars: Record<string, string | undefined> = {
    GOOGLE_OAUTH_CLIENT_ID:     process.env.GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    GOOGLE_OAUTH_REFRESH_TOKEN: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
  };

  const missingVars = Object.entries(vars)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missingVars.length === Object.keys(vars).length) {
    return { status: 'not_configured', connected: false, missingVars, error: null };
  }

  if (missingVars.length > 0) {
    return { status: 'partially_configured', connected: false, missingVars, error: null };
  }

  // All vars are present — make a lightweight API call to verify credentials
  try {
    const { drive } = await getDriveClient();
    await drive.about.get({ fields: 'user' });
    return { status: 'connected', connected: true, missingVars: [], error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isAuthErr =
      err instanceof DriveAuthError ||
      /invalid.*(grant|credentials|token)|unauthorized|401|403/i.test(msg);
    return {
      status: isAuthErr ? 'auth_failed' : 'configured',
      connected: false,
      missingVars: [],
      error: isAuthErr
        ? `Google Drive API authentication failed: ${msg}`
        : `Google Drive API error: ${msg}`,
    };
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
 * Falls back to the `google_oauth_tokens` DB table for the refresh token
 * when the env var is absent.
 *
 * @throws DriveAuthError when credentials are present but rejected by Google.
 */
async function getDriveClient(): Promise<{ drive: drive_v3.Drive; rootFolderId: string }> {
  const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const rawFolderId  = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!clientId)     throw new Error('Missing env var: GOOGLE_OAUTH_CLIENT_ID');
  if (!clientSecret) throw new Error('Missing env var: GOOGLE_OAUTH_CLIENT_SECRET');
  if (!rawFolderId)  throw new Error('Missing env var: GOOGLE_DRIVE_FOLDER_ID');

  // Prefer env var; fall back to DB-stored token.
  let refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!refreshToken) {
    console.log('[google-drive] GOOGLE_OAUTH_REFRESH_TOKEN not set — reading from DB');
    refreshToken = (await getStoredRefreshToken()) || undefined;
  }

  if (!refreshToken) {
    throw new DriveAuthError('No refresh token found — Google Drive must be reconnected');
  }

  console.log('[google-drive] Env vars loaded ✓ (CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN, FOLDER_ID)');

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
  const { drive, rootFolderId } = await getDriveClient();
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
  const { drive } = await getDriveClient();

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
 * @throws DriveAuthError when OAuth credentials are rejected by Google.
 */
export async function deleteFromDrive(fileId: string): Promise<void> {
  const { drive } = await getDriveClient();
  try {
    await drive.files.delete({ fileId, supportsAllDrives: true });
  } catch (err: unknown) {
    const status  = (err as { code?: number })?.code;
    const message = err instanceof Error ? err.message : String(err);
    if (status === 404 || /not found/i.test(message)) {
      throw new DriveFileNotFoundError(fileId);
    }
    if (isAuthError(err)) {
      await clearStoredRefreshToken();
      throw new DriveAuthError(message);
    }
    throw err;
  }
}

/**
 * Rename a file in Google Drive.
 * @throws DriveFileNotFoundError when the file is already gone (404).
 * @throws DriveAuthError when OAuth credentials are rejected by Google.
 */
export async function renameInDrive(fileId: string, newName: string): Promise<void> {
  const { drive } = await getDriveClient();
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
    if (isAuthError(err)) {
      await clearStoredRefreshToken();
      throw new DriveAuthError(message);
    }
    throw err;
  }
}

/**
 * Return true if the file exists in Google Drive, false on 404.
 */
export async function checkDriveFileExists(fileId: string): Promise<boolean> {
  const { drive } = await getDriveClient();
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
  const { drive } = await getDriveClient();

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
  const { drive } = await getDriveClient();
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
  const { drive, rootFolderId } = await getDriveClient();
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
