import { S3Client, CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Readable } from 'stream';
import {
  getR2Config,
  checkR2Config,
  buildR2Url,
  uploadToR2,
  deleteFromR2,
  createMultipartUpload,
  uploadPartToR2,
  completeMultipartUpload,
  abortMultipartUpload,
  objectExistsInR2,
  R2NotFoundError,
  R2ConfigError,
} from '@/lib/r2';
import { buildStoragePath } from '@/lib/storage/path-builder';
import type {
  MultipartCompletedPart,
  MultipartInitResult,
  StorageListedFile,
  StorageObjectResult,
  UploadFileInput,
  UploadFileResult,
} from '@/lib/storage/types';

function buildClient() {
  const config = getR2Config();
  return {
    config,
    client: new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    }),
  };
}

export function getFileUrl(key: string): string {
  return buildR2Url(key);
}

export async function getSignedFileUrl(key: string, _expiresInSeconds = 900): Promise<string> {
  const expiresInSeconds = Number.isFinite(_expiresInSeconds) && _expiresInSeconds > 0
    ? Math.floor(_expiresInSeconds)
    : 900;
  const { client, config } = buildClient();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: config.bucketName, Key: key }),
    { expiresIn: expiresInSeconds },
  );
}

export async function uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
  return uploadToR2(input.key, input.body, input.contentType);
}

export async function deleteFile(key: string): Promise<void> {
  await deleteFromR2(key);
}

export async function replaceFile(oldKey: string | null | undefined, input: UploadFileInput): Promise<UploadFileResult> {
  const uploaded = await uploadFile(input);
  if (oldKey && oldKey !== input.key) {
    try {
      await deleteFile(oldKey);
    } catch {
      // Ignore cleanup failures after successful replacement upload.
    }
  }
  return uploaded;
}

export async function moveFile(fromKey: string, toKey: string): Promise<{ key: string; publicUrl: string }> {
  const { client, config } = buildClient();

  await client.send(new CopyObjectCommand({
    Bucket: config.bucketName,
    CopySource: `${config.bucketName}/${fromKey}`,
    Key: toKey,
  }));

  await client.send(new DeleteObjectCommand({
    Bucket: config.bucketName,
    Key: fromKey,
  }));

  return { key: toKey, publicUrl: buildR2Url(toKey, config.publicUrl) };
}

export async function listFilesByPrefix(prefix: string, maxKeys = 1000): Promise<StorageListedFile[]> {
  const { client, config } = buildClient();
  const result = await client.send(new ListObjectsV2Command({
    Bucket: config.bucketName,
    Prefix: prefix,
    MaxKeys: maxKeys,
  }));

  return (result.Contents ?? []).map(item => ({
    key: item.Key ?? '',
    size: item.Size,
    lastModified: item.LastModified,
  })).filter(item => Boolean(item.key));
}

export async function getFileObject(key: string): Promise<StorageObjectResult> {
  const { client, config } = buildClient();
  const result = await client.send(new GetObjectCommand({
    Bucket: config.bucketName,
    Key: key,
  }));

  return {
    body: result.Body as Readable,
    contentType: result.ContentType,
    contentLength: typeof result.ContentLength === 'number' ? result.ContentLength : undefined,
  };
}

export async function createMultipartUploadSession(
  key: string,
  contentType: string,
): Promise<MultipartInitResult> {
  return createMultipartUpload(key, contentType);
}

export async function uploadMultipartPart(
  key: string,
  uploadId: string,
  partNumber: number,
  body: Buffer,
): Promise<{ etag: string; partNumber: number }> {
  return uploadPartToR2(key, uploadId, partNumber, body);
}

export async function completeMultipartUploadSession(
  key: string,
  uploadId: string,
  parts: MultipartCompletedPart[],
): Promise<{ publicUrl: string }> {
  return completeMultipartUpload(key, uploadId, parts);
}

export async function abortMultipartUploadSession(key: string, uploadId: string): Promise<void> {
  await abortMultipartUpload(key, uploadId);
}

export async function fileExists(key: string): Promise<boolean> {
  return objectExistsInR2(key);
}

export function getStorageBucketName(): string {
  return getR2Config().bucketName;
}

export function getStorageConfigStatus(): { configured: boolean; missingVars: string[] } {
  return checkR2Config();
}

export { R2ConfigError };
export { R2NotFoundError };
export { buildStoragePath };
