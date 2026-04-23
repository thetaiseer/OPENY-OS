import { getServiceClient } from '@/lib/supabase/service-client';
import type { StoredFileMetadataInput } from '@/lib/storage/types';

export async function saveStoredFileMetadata(
  input: StoredFileMetadataInput,
): Promise<{ id: string } | null> {
  const db = getServiceClient();

  const payload = {
    id: input.id,
    module: input.module,
    section: input.section,
    entity_id: input.entityId,
    original_name: input.originalName,
    stored_name: input.storedName,
    mime_type: input.mimeType,
    size_bytes: input.sizeBytes,
    r2_key: input.r2Key,
    file_url: input.fileUrl,
    uploaded_by: input.uploadedBy,
    visibility: input.visibility ?? 'public',
  };

  const { data, error } = await db.from('stored_files').insert(payload).select('id').maybeSingle();

  if (error) {
    // Keep runtime backward compatible while migration rolls out.
    if (
      error.code === '42P01' || // relation does not exist
      /stored_files/i.test(error.message)
    ) {
      console.warn(
        '[storage/metadata] stored_files table not available yet, skipping metadata insert',
      );
      return null;
    }
    throw new Error(`[storage/metadata] failed to persist metadata: ${error.message}`);
  }
  return data ?? null;
}
