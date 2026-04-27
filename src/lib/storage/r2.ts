import {
  deleteFile,
  fileExists,
  listFilesByPrefix,
  getFileUrl,
  R2ConfigError,
  R2NotFoundError,
  type StorageListedFile,
} from '@/lib/storage';

// ─── deleteObject ─────────────────────────────────────────────────────────────

/**
 * Delete one object from Cloudflare R2 by key.
 * Server-side only. Never call from client components.
 *
 * Returns success=true even when the object was already missing (idempotent).
 */
export async function deleteR2Object(key: string): Promise<{
  success: boolean;
  missing?: boolean;
  configMissing?: boolean;
  error?: string;
}> {
  const trimmedKey = key.trim().replace(/^\/+/, '');
  if (!trimmedKey) {
    return { success: false, error: 'Missing R2 object key' };
  }

  try {
    await deleteFile(trimmedKey);
    return { success: true };
  } catch (error) {
    if (error instanceof R2NotFoundError) {
      return { success: true, missing: true };
    }
    if (error instanceof R2ConfigError) {
      return { success: false, configMissing: true, error: error.message };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown R2 deletion error',
    };
  }
}

/** Alias so callers can use a consistent camelCase name. */
export const deleteObject = deleteR2Object;

// ─── objectExists ─────────────────────────────────────────────────────────────

/**
 * Check whether a key exists in R2.
 * Returns false when R2 is not configured (rather than throwing).
 */
export async function objectExists(key: string): Promise<{
  exists: boolean;
  configMissing?: boolean;
  error?: string;
}> {
  const trimmedKey = key.trim().replace(/^\/+/, '');
  if (!trimmedKey) return { exists: false, error: 'Missing R2 object key' };

  try {
    const exists = await fileExists(trimmedKey);
    return { exists };
  } catch (error) {
    if (error instanceof R2ConfigError) {
      return { exists: false, configMissing: true };
    }
    return {
      exists: false,
      error: error instanceof Error ? error.message : 'Unknown R2 error',
    };
  }
}

// ─── listObjects ─────────────────────────────────────────────────────────────

/**
 * List all object keys in R2 under a given prefix.
 * Returns an empty array when R2 is not configured.
 */
export async function listObjects(prefix: string): Promise<{
  files: StorageListedFile[];
  keys: string[];
  configMissing?: boolean;
  error?: string;
}> {
  try {
    const files = await listFilesByPrefix(prefix);
    return { files, keys: files.map((f) => f.key) };
  } catch (error) {
    if (error instanceof R2ConfigError) {
      return { files: [], keys: [], configMissing: true };
    }
    return {
      files: [],
      keys: [],
      error: error instanceof Error ? error.message : 'Unknown R2 error',
    };
  }
}

// ─── getPublicUrl ─────────────────────────────────────────────────────────────

/**
 * Build the public CDN URL for an R2 object key.
 * Falls back to '' when R2_PUBLIC_URL is not set.
 */
export function getPublicUrl(key: string): string {
  const base = (process.env.R2_PUBLIC_URL ?? '').trim().replace(/\/+$/, '');
  if (!base || !key) return '';
  const cleanKey = key.replace(/^\/+/, '');
  return `${base}/${cleanKey}`;
}

/**
 * Resolve the public URL via the storage service.
 * Falls back to the env-var helper when getFileUrl throws.
 */
export function getPublicUrlSafe(key: string): string {
  const trimmedKey = key.trim().replace(/^\/+/, '');
  if (!trimmedKey) return '';
  try {
    return getFileUrl(trimmedKey);
  } catch {
    return getPublicUrl(trimmedKey);
  }
}
