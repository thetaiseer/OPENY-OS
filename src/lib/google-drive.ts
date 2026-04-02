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

  console.log('[google-drive] uploading file:', fileName, '| mimeType:', mimeType, '| size (bytes):', buffer.length);
  console.log('[google-drive] target folder_id:', folderId);

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
