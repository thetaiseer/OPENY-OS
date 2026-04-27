import { deleteFile, R2ConfigError, R2NotFoundError } from '@/lib/storage';

/**
 * Delete one object from Cloudflare R2 by key.
 * Server-side only. Never call from client components.
 */
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
    await deleteFile(trimmedKey);
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
    return {
      success: false,
      error: message,
    };
  }
}
