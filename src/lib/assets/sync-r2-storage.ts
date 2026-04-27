import type { SupabaseClient } from '@supabase/supabase-js';
import { listFilesByPrefix, fileExists } from '@/lib/storage/service';

export type SyncR2StorageResult = {
  workspacesProcessed: number;
  assetsChecked: number;
  markedMissing: number;
  orphanObjectKeysLogged: number;
  errors: string[];
};

type AssetKeyRow = {
  id: string;
  workspace_id: string | null;
  storage_key: string | null;
  file_path: string | null;
};

function canonicalKey(row: AssetKeyRow): string | null {
  const k = (row.storage_key ?? '').trim() || (row.file_path ?? '').trim();
  const cleaned = k.replace(/^\/+/, '');
  return cleaned || null;
}

async function fetchActiveAssetsForWorkspace(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<{ rows: AssetKeyRow[]; error?: string }> {
  let { data, error } = await supabase
    .from('assets')
    .select('id, workspace_id, storage_key, file_path')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null);

  if (error?.code === '42703' || error?.code === 'PGRST204') {
    const fb = await supabase
      .from('assets')
      .select('id, workspace_id, storage_key, file_path')
      .eq('workspace_id', workspaceId)
      .neq('is_deleted', true);
    data = fb.data;
    error = fb.error;
  }

  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as AssetKeyRow[] };
}

/**
 * Marks DB rows whose storage_key no longer exists in R2.
 * Optionally logs R2 object keys under each workspace prefix that have no matching active DB row.
 */
export async function syncAssetsWithR2Storage(
  supabase: SupabaseClient,
  options: { logOrphanObjects?: boolean; maxOrphansPerWorkspace?: number } = {},
): Promise<SyncR2StorageResult> {
  const logOrphans = options.logOrphanObjects ?? true;
  const maxOrphans = options.maxOrphansPerWorkspace ?? 200;
  const result: SyncR2StorageResult = {
    workspacesProcessed: 0,
    assetsChecked: 0,
    markedMissing: 0,
    orphanObjectKeysLogged: 0,
    errors: [],
  };

  const { data: workspaces, error: wsErr } = await supabase.from('workspaces').select('id');
  if (wsErr) {
    result.errors.push(wsErr.message);
    return result;
  }

  for (const ws of workspaces ?? []) {
    const workspaceId = ws.id as string;
    result.workspacesProcessed++;

    const { rows, error } = await fetchActiveAssetsForWorkspace(supabase, workspaceId);
    if (error) {
      result.errors.push(`workspace ${workspaceId}: ${error}`);
      continue;
    }

    const dbKeys = new Set<string>();
    for (const row of rows) {
      const key = canonicalKey(row);
      if (key) dbKeys.add(key);
    }

    for (const row of rows) {
      const key = canonicalKey(row);
      if (!key) continue;
      result.assetsChecked++;
      try {
        const exists = await fileExists(key);
        if (exists) continue;

        const payloadFull = {
          missing_in_storage: true,
          sync_status: 'missing',
          updated_at: new Date().toISOString(),
        };
        const payloadMin = { missing_in_storage: true, sync_status: 'missing' };

        let { error: upErr } = await supabase
          .from('assets')
          .update(payloadFull)
          .eq('id', row.id)
          .eq('workspace_id', workspaceId);

        if (upErr?.code === '42703' || upErr?.code === 'PGRST204') {
          ({ error: upErr } = await supabase
            .from('assets')
            .update(payloadMin)
            .eq('id', row.id)
            .eq('workspace_id', workspaceId));
        }
        if (upErr) {
          result.errors.push(`update ${row.id}: ${upErr.message}`);
        } else {
          result.markedMissing++;
        }
      } catch (e) {
        result.errors.push(`head ${row.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (!logOrphans) continue;

    try {
      const prefix = `workspaces/${workspaceId}/`;
      const listed = await listFilesByPrefix(prefix, maxOrphans * 2);
      for (const obj of listed) {
        if (!obj.key || obj.key.endsWith('/')) continue;
        if (dbKeys.has(obj.key)) continue;
        if (obj.key.includes('/thumbnails/')) continue;
        console.warn('[assets/sync-r2] orphan R2 object (no active DB row):', obj.key);
        result.orphanObjectKeysLogged++;
        if (result.orphanObjectKeysLogged >= maxOrphans) break;
      }
    } catch (e) {
      result.errors.push(
        `list orphans ${workspaceId}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  return result;
}
