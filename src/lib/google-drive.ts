/**
 * Server-only Google Drive utility.
 * Never import this file from client components.
 */
import { google } from 'googleapis';
import { Readable } from 'stream';

export interface DriveUploadResult {
  drive_file_id: string;
  webViewLink: string;
  webContentLink: string;
}

function getDriveClient() {
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!clientEmail || !privateKey || !folderId) {
    throw new Error(
      'Missing Google Drive env vars: GOOGLE_DRIVE_CLIENT_EMAIL, GOOGLE_DRIVE_PRIVATE_KEY, GOOGLE_DRIVE_FOLDER_ID',
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  return { drive: google.drive({ version: 'v3', auth }), folderId };
}

/**
 * Upload a file buffer to Google Drive and make it publicly readable.
 * Returns drive_file_id, webViewLink, webContentLink.
 */
export async function uploadToDrive(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<DriveUploadResult> {
  const { drive, folderId } = getDriveClient();

  const readableStream = Readable.from(buffer);

  const createRes = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: readableStream,
    },
    fields: 'id,webViewLink,webContentLink',
  });

  const fileId = createRes.data.id;
  if (!fileId) {
    throw new Error('Google Drive upload succeeded but returned no file ID');
  }

  // Grant anyone with the link read access (makes webContentLink usable)
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });

  // Fetch updated links after permission change
  const metaRes = await drive.files.get({
    fileId,
    fields: 'id,webViewLink,webContentLink',
  });

  return {
    drive_file_id: fileId,
    webViewLink: metaRes.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`,
    webContentLink:
      metaRes.data.webContentLink ??
      `https://drive.google.com/uc?id=${fileId}&export=download`,
  };
}

/**
 * Delete a file from Google Drive by its file ID.
 * Throws on failure so the caller can surface the exact error.
 */
export async function deleteFromDrive(fileId: string): Promise<void> {
  const { drive } = getDriveClient();
  await drive.files.delete({ fileId });
}
