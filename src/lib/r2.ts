/**
 * Cloudflare R2 storage client — server-only.
 *
 * R2 is S3-compatible; we use the AWS SDK v3 S3 client pointed at the R2 endpoint.
 * Never import this file from client components.
 *
 * Required environment variables:
 *   R2_ACCOUNT_ID        – Cloudflare account ID
 *   R2_ACCESS_KEY_ID     – R2 API token (Access Key ID)
 *   R2_SECRET_ACCESS_KEY – R2 API token (Secret Access Key)
 *   R2_BUCKET_NAME       – bucket name (default: client-assets)
 *   R2_PUBLIC_URL        – public base URL for the bucket (no trailing slash)
 *                          e.g. https://assets.example.com  or  https://pub-xxx.r2.dev
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';

// ── Error classes ─────────────────────────────────────────────────────────────

/** Thrown when an R2 object does not exist (404 / NoSuchKey). */
export class R2NotFoundError extends Error {
  constructor(key: string) {
    super(`R2 object not found: ${key}`);
    this.name = 'R2NotFoundError';
  }
}

/** Thrown when R2 credentials are invalid or missing. */
export class R2ConfigError extends Error {
  constructor(detail: string) {
    super(`R2 configuration error: ${detail}`);
    this.name = 'R2ConfigError';
  }
}

// ── Config helpers ────────────────────────────────────────────────────────────

export interface R2Config {
  accountId:       string;
  accessKeyId:     string;
  secretAccessKey: string;
  bucketName:      string;
  publicUrl:       string;
}

/**
 * Read and validate required R2 env vars.
 * Returns a typed config object or throws R2ConfigError listing the missing vars.
 */
export function getR2Config(): R2Config {
  const missing: string[] = [];

  const accountId       = process.env.R2_ACCOUNT_ID ?? '';
  const accessKeyId     = process.env.R2_ACCESS_KEY_ID ?? '';
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? '';
  const bucketName      = process.env.R2_BUCKET_NAME ?? 'client-assets';
  const publicUrl       = process.env.R2_PUBLIC_URL ?? '';

  if (!accountId)       missing.push('R2_ACCOUNT_ID');
  if (!accessKeyId)     missing.push('R2_ACCESS_KEY_ID');
  if (!secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY');
  if (!publicUrl)       missing.push('R2_PUBLIC_URL');

  if (missing.length > 0) {
    throw new R2ConfigError(`Missing environment variable(s): ${missing.join(', ')}`);
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl };
}

/**
 * Check whether R2 is configured (all required env vars are set).
 * Returns { configured: true } or { configured: false, missingVars }.
 */
export function checkR2Config(): { configured: boolean; missingVars: string[] } {
  const missingVars: string[] = [];
  if (!process.env.R2_ACCOUNT_ID)        missingVars.push('R2_ACCOUNT_ID');
  if (!process.env.R2_ACCESS_KEY_ID)     missingVars.push('R2_ACCESS_KEY_ID');
  if (!process.env.R2_SECRET_ACCESS_KEY) missingVars.push('R2_SECRET_ACCESS_KEY');
  if (!process.env.R2_PUBLIC_URL)        missingVars.push('R2_PUBLIC_URL');
  return { configured: missingVars.length === 0, missingVars };
}

// ── Client factory ────────────────────────────────────────────────────────────

function buildS3Client(config: R2Config): S3Client {
  return new S3Client({
    region:   'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

// ── URL helpers ───────────────────────────────────────────────────────────────

/**
 * Build the public URL for an R2 object.
 * R2_PUBLIC_URL must NOT have a trailing slash.
 */
export function buildR2Url(key: string, publicUrl?: string): string {
  const base = publicUrl ?? process.env.R2_PUBLIC_URL ?? '';
  return `${base.replace(/\/$/, '')}/${key}`;
}

// ── Storage operations ────────────────────────────────────────────────────────

export interface UploadResult {
  key:       string;
  publicUrl: string;
  bucket:    string;
}

/**
 * Upload a file buffer to R2.
 *
 * @param key         – object key (path within the bucket)
 * @param body        – file content as a Buffer
 * @param contentType – MIME type
 * @returns UploadResult with the public URL
 */
export async function uploadToR2(
  key:         string,
  body:        Buffer,
  contentType: string,
): Promise<UploadResult> {
  const config = getR2Config();
  const client = buildS3Client(config);

  await client.send(
    new PutObjectCommand({
      Bucket:      config.bucketName,
      Key:         key,
      Body:        body,
      ContentType: contentType,
    }),
  );

  return {
    key,
    publicUrl: buildR2Url(key, config.publicUrl),
    bucket:    config.bucketName,
  };
}

/**
 * Delete an object from R2.
 * Throws R2NotFoundError if the object does not exist.
 * Throws R2ConfigError if env vars are missing.
 */
export async function deleteFromR2(key: string): Promise<void> {
  const config = getR2Config();
  const client = buildS3Client(config);

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: config.bucketName,
        Key:    key,
      }),
    );
  } catch (err: unknown) {
    const code = (err as { name?: string; Code?: string })?.name ??
                 (err as { name?: string; Code?: string })?.Code ?? '';
    if (code === 'NoSuchKey' || code === 'NotFound') {
      throw new R2NotFoundError(key);
    }
    throw err;
  }
}

/**
 * Check whether an R2 object exists (via HeadObject).
 * Returns false if the object is missing (404).
 * Throws on auth/network errors.
 */
export async function objectExistsInR2(key: string): Promise<boolean> {
  const config = getR2Config();
  const client = buildS3Client(config);

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: config.bucketName,
        Key:    key,
      }),
    );
    return true;
  } catch (err: unknown) {
    const code = (err as { name?: string; Code?: string })?.name ??
                 (err as { name?: string; Code?: string })?.Code ?? '';
    if (code === 'NoSuchKey' || code === 'NotFound' || code === '404') {
      return false;
    }
    throw err;
  }
}
