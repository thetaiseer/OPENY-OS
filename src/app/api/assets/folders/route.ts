import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { getServiceClient } from '@/lib/supabase/service-client';
import { resolveWorkspaceForRequest } from '@/lib/api-workspace';
import { deleteR2Object } from '@/lib/storage/r2';

type FolderDeleteBody = {
  folderName?: string;
  clientId?: string;
  category?: string;
  year?: string;
  workspaceId?: string;
};

type AssetRow = {
  id: string;
  file_path?: string | null;
  storage_key?: string | null;
  storage_provider?: string | null;
  client_id?: string | null;
  client_name?: string | null;
  main_category?: string | null;
  month_key?: string | null;
  deleted_at?: string | null;
  is_deleted?: boolean | null;
  missing_in_storage?: boolean | null;
  sync_status?: string | null;
};

function isActiveAsset(row: {
  deleted_at?: string | null;
  is_deleted?: boolean | null;
  missing_in_storage?: boolean | null;
  sync_status?: string | null;
}): boolean {
  const sync = (row.sync_status ?? 'synced').toLowerCase();
  return (
    !row.deleted_at &&
    !(row.is_deleted ?? false) &&
    !(row.missing_in_storage ?? false) &&
    sync !== 'deleted' &&
    sync !== 'missing'
  );
}

function storageKeyForDelete(asset: AssetRow): string | null {
  const key = (asset.storage_key ?? '').trim() || (asset.file_path ?? '').trim();
  return key ? key.replace(/^\/+/, '') : null;
}

export async function DELETE(req: NextRequest) {
  const auth = await requireRole(req, ['owner', 'admin']);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as FolderDeleteBody;
  const supabase = getServiceClient();
  const workspaceResolution = await resolveWorkspaceForRequest(req, supabase, auth.profile.id, {
    allowWorkspaceFallbackWithoutMembership: true,
  });
  const workspaceId = body.workspaceId?.trim() || workspaceResolution.workspaceId;
  if (!workspaceId) {
    return NextResponse.json(
      { success: false, error: workspaceResolution.error ?? 'Workspace not found' },
      { status: 403 },
    );
  }

  let query = supabase
    .from('assets')
    .select(
      'id, file_path, storage_key, storage_provider, client_id, client_name, main_category, month_key, deleted_at, is_deleted, missing_in_storage, sync_status',
    )
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .or('is_deleted.is.null,is_deleted.eq.false')
    .or('missing_in_storage.is.null,missing_in_storage.eq.false');

  if (body.clientId) query = query.eq('client_id', body.clientId);
  if (body.folderName) query = query.eq('client_name', body.folderName);
  if (body.category) query = query.eq('main_category', body.category);
  if (body.year) query = query.like('month_key', `${body.year}-%`);

  const { data: assets, error: assetsError } = await query;
  if (assetsError) {
    return NextResponse.json({ success: false, error: assetsError.message }, { status: 500 });
  }

  const activeAssets = ((assets ?? []) as AssetRow[]).filter(isActiveAsset);
  if (activeAssets.length === 0) {
    return NextResponse.json({ success: true, deletedCount: 0 });
  }

  for (const asset of activeAssets) {
    const key = storageKeyForDelete(asset);
    if (!key || (asset.storage_provider ?? 'r2') !== 'r2') continue;
    const r2Delete = await deleteR2Object(key);
    if (!r2Delete.success && !r2Delete.missing) {
      console.warn('[assets/folders] R2 delete failed; continuing', {
        assetId: asset.id,
        key,
        error: r2Delete.error ?? null,
      });
    }
  }

  const nowIso = new Date().toISOString();
  const ids = activeAssets.map((a) => a.id);
  const { error: linksError } = await supabase
    .from('task_asset_links')
    .delete()
    .in('asset_id', ids);
  if (linksError && linksError.code !== '42P01') {
    console.warn('[assets/folders] failed deleting task_asset_links', linksError);
  }
  const { error: tasksError } = await supabase
    .from('tasks')
    .update({ asset_id: null })
    .in('asset_id', ids)
    .eq('workspace_id', workspaceId);
  if (tasksError && tasksError.code !== '42703') {
    console.warn('[assets/folders] failed clearing tasks.asset_id', tasksError);
  }
  const { error: schedulesError } = await supabase
    .from('publishing_schedules')
    .update({ asset_id: null })
    .in('asset_id', ids)
    .eq('workspace_id', workspaceId);
  if (schedulesError && schedulesError.code !== '42703' && schedulesError.code !== '42P01') {
    console.warn('[assets/folders] failed clearing publishing_schedules.asset_id', schedulesError);
  }

  const { error: softDeleteError } = await supabase
    .from('assets')
    .update({
      deleted_at: nowIso,
      is_deleted: true,
      sync_status: 'deleted',
      missing_in_storage: false,
      updated_at: nowIso,
    })
    .in('id', ids)
    .eq('workspace_id', workspaceId);

  if (softDeleteError) {
    return NextResponse.json({ success: false, error: softDeleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, deletedCount: ids.length });
}
