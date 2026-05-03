import { fileExists } from '@/lib/storage/service';
import { buildWorkspaceAssetR2Key, randomKeySuffix } from '@/lib/storage/workspace-asset-key';

/**
 * Reserves a workspace-scoped R2 key that does not already exist in R2.
 * DB-level dedupe is enforced again in /api/upload/complete.
 */
export async function allocateWorkspaceAssetStorageKey(
  workspaceId: string,
  clientId: string | null,
  monthKey: string,
  originalFileName: string,
  mainCategory?: string | null,
  subCategory?: string | null,
): Promise<{ storageKey: string }> {
  for (let attempt = 0; attempt < 16; attempt++) {
    const suffix = attempt === 0 ? undefined : randomKeySuffix();
    const storageKey = buildWorkspaceAssetR2Key({
      workspaceId,
      clientId,
      monthKey,
      originalDisplayName: originalFileName,
      uniqueSuffix: suffix,
      mainCategory,
      subCategory,
    });

    const inR2 = await fileExists(storageKey);
    if (!inR2) return { storageKey };
  }

  throw new Error('Could not allocate a unique storage key after several attempts');
}
