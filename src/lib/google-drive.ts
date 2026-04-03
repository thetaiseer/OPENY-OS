/**
 * Server-only Google Drive utility.
 * Never import this file from client components.
 */
import { google } from 'googleapis';
import type { drive_v3 } from 'googleapis';
import { Readable } from 'stream';
import { clientToFolderName } from './asset-utils';

export interface DriveUploadResult {
  drive_file_id: string;
  drive_folder_id: string;
  webViewLink: string;
  webContentLink: string;
}

function getDriveClient() {
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const rawKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY;
  const privateKey = rawKey?.replace(/\\n/g, '\n');
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  console.log('[google-drive] init — client_email:', clientEmail ?? '(missing)');
  console.log('[google-drive] init — private_key present:', !!privateKey, '| length:', privateKey?.length ?? 0);
  console.log('[google-drive] init — folder_id:', folderId ?? '(missing)');

  if (!clientEmail || !privateKey || !folderId) {
    throw new Error(
      'Missing Google Drive env vars: GOOGLE_DRIVE_CLIENT_EMAIL, GOOGLE_DRIVE_PRIVATE_KEY, GOOGLE_DRIVE_FOLDER_ID',
    );
  }

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

  const readableStream = Readable.from(buffer);

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
    },
    fields: 'id,webViewLink,webContentLink',
  });

  console.log('[google-drive] create response status:', createRes.status);
  console.log('[google-drive] create response data:', JSON.stringify(createRes.data));

  const fileId = createRes.data.id;
  if (!fileId) {
    throw new Error('Google Drive upload succeeded but returned no file ID');
  }

  console.log('[google-drive] file ID:', fileId);

  // Grant anyone with the link read access (makes webContentLink usable)
  const permRes = await drive.permissions.create({
    fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });
  console.log('[google-drive] permission create status:', permRes.status);

  // Fetch updated links after permission change
  const metaRes = await drive.files.get({
    fileId,
    fields: 'id,webViewLink,webContentLink',
  });

  const result = {
    drive_file_id: fileId,
    webViewLink: metaRes.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`,
    webContentLink:
      metaRes.data.webContentLink ??
      `https://drive.google.com/uc?id=${fileId}&export=download`,
  };

  console.log('[google-drive] final links — webViewLink:', result.webViewLink);
  console.log('[google-drive] final links — webContentLink:', result.webContentLink);

  return result;
}

/**
 * Delete a file from Google Drive by its file ID.
 * Throws on failure so the caller can surface the exact error.
 */
export async function deleteFromDrive(fileId: string): Promise<void> {
  const { drive } = getDriveClient();
  await drive.files.delete({ fileId });
}

