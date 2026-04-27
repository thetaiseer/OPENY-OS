/**
 * Central R2 (S3-compatible) helpers for OPENY OS.
 * Re-exports low-level primitives from `@/lib/r2` and `@/lib/storage/service`.
 * Prefer importing from here in app code so storage behavior stays in one place.
 *
 * Server-only — never import from client components.
 */

import {
  uploadToR2,
  deleteFromR2,
  objectExistsInR2,
  buildR2Url,
  getR2Config,
  checkR2Config,
  R2ConfigError,
  R2NotFoundError,
} from '@/lib/r2';
import { listFilesByPrefix } from '@/lib/storage/service';
import type { StorageListedFile } from '@/lib/storage/types';

export { R2ConfigError, R2NotFoundError, getR2Config, checkR2Config };

export async function uploadObject(
  key: string,
  body: Buffer,
  contentType: string,
): ReturnType<typeof uploadToR2> {
  return uploadToR2(key, body, contentType);
}

export async function deleteObject(key: string): Promise<void> {
  await deleteFromR2(key);
}

export async function objectExists(key: string): Promise<boolean> {
  return objectExistsInR2(key);
}

export async function listObjects(prefix: string, maxKeys = 1000): Promise<StorageListedFile[]> {
  return listFilesByPrefix(prefix, maxKeys);
}

export function getPublicUrl(key: string): string {
  return buildR2Url(key);
}

/** @deprecated use deleteObject — kept for existing imports */
export async function deleteR2Object(key: string): Promise<{
  success: boolean;
  missing?: boolean;
  configMissing?: boolean;
  configInvalid?: boolean;
  error?: string;
}> {
  const trimmedKey = key.trim().replace(/^\/+/, '');
  if (!trimmedKey) {
    return { success: false, error: 'Missing R2 object key' };
  }

  try {
    await deleteFromR2(trimmedKey);
    return { success: true };
  } catch (error) {
    if (error instanceof R2NotFoundError) {
      return { success: true, missing: true };
    }
    if (error instanceof R2ConfigError) {
      return { success: false, configMissing: true, error: error.message };
    }
    const message = error instanceof Error ? error.message : 'Unknown R2 deletion error';
    const lowered = message.toLowerCase();
    if (
      lowered.includes('invalidaccesskeyid') ||
      lowered.includes('signaturedoesnotmatch') ||
      lowered.includes('access denied') ||
      lowered.includes('forbidden') ||
      lowered.includes('credentials')
    ) {
      return { success: false, configInvalid: true, error: message };
    }
    return { success: false, error: message };
  }
}
