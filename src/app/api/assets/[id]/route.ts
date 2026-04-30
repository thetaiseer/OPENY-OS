import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { resolveWorkspaceForRequest } from '@/lib/api-workspace';
import { deleteR2Object } from '@/lib/storage/r2';

type AssetRow = {
  id: string;
  workspace_id: string | null;
  file_path?: string | null;
  storage_key?: string | null;
  bucket_name?: string | null;
  name?: string | null;
  storage_provider?: string | null;
  file_url?: string | null;
  preview_url?: string | null;
  download_url?: string | null;
};

/** Canonical R2 key for delete — never derive from public URLs. */
function extractStorageKey(asset: AssetRow): string | null {
  const direct = (asset.storage_key ?? '').trim() || (asset.file_path ?? '').trim();
  return direct ? direct.replace(/^\/+/, '') : null;
}

// ── DELETE /api/assets/[id] ───────────────────────────────────────────────────
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, ['owner', 'admin', 'manager']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing asset id' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const softDelete = searchParams.get('soft') === 'true';

    const supabase = getServiceClient();
    const { workspaceId, error: workspaceError } = await resolveWorkspaceForRequest(
      req,
      supabase,
      auth.profile.id,
      { allowWorkspaceFallbackWithoutMembership: true },
    );
    if (!workspaceId) {
      return NextResponse.json(
        { success: false, error: workspaceError ?? 'Workspace not found' },
        { status: 403 },
      );
    }
    const membershipCheck = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', auth.profile.id)
      .maybeSingle();
    const membershipFound = Boolean(membershipCheck.data?.id);
    // eslint-disable-next-line no-console
    console.info('[debug-delete] route=/api/assets/[id] step=authorized', {
      recordId: id,
      workspaceId,
      requesterUserId: auth.profile.id,
      membershipFound,
    });

    let asset: AssetRow | null = null;
    let fetchError: { code?: string; message?: string } | null = null;
    const primary = await supabase
      .from('assets')
      .select(
        'id, workspace_id, file_path, storage_key, bucket_name, name, storage_provider, file_url, preview_url, download_url',
      )
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    asset = primary.data as AssetRow | null;
    fetchError = primary.error;

    if (fetchError?.code === '42703') {
      // Backward compatibility for schemas missing one or more newer columns.
      const fallback = await supabase
        .from('assets')
        .select('id, workspace_id, file_path, storage_key, bucket_name, name, file_url')
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .maybeSingle();
      asset = fallback.data as AssetRow | null;
      fetchError = fallback.error;
    }

    if (fetchError || !asset) {
      return NextResponse.json(
        { success: false, error: 'Asset not found', code: 'ASSET_NOT_FOUND' },
        { status: 404 },
      );
    }

    if (softDelete) {
      const { error: dbError } = await supabase
        .from('assets')
        .update({ is_deleted: true })
        .eq('id', id);

      if (dbError) {
        console.error('[asset-delete] soft delete DB update failed', {
          assetId: asset.id,
          error: dbError.message,
        });
        return NextResponse.json(
          { success: false, error: `Database update failed: ${dbError.message}` },
          { status: 500 },
        );
      }

      return NextResponse.json({ success: true, message: 'Asset marked as deleted.', soft: true });
    }

    const storageKey = extractStorageKey(asset as AssetRow);
    let r2Warning: string | undefined;
    if (storageKey && (asset.storage_provider ?? 'r2') === 'r2') {
      const r2Delete = await deleteR2Object(storageKey);
      if (!r2Delete.success) {
        if (r2Delete.configMissing || r2Delete.configInvalid) {
          return NextResponse.json(
            {
              success: false,
              error: 'R2 deletion failed. Check R2 configuration.',
              code: 'R2_DELETE_FAILED',
            },
            { status: 500 },
          );
        }
        return NextResponse.json(
          {
            success: false,
            error: r2Delete.error ?? 'R2 deletion failed.',
            code: 'R2_DELETE_FAILED',
          },
          { status: 500 },
        );
      }
      if (r2Delete.missing) {
        console.warn('[asset-delete] R2 object already missing; continuing with soft-delete', {
          storageKey,
        });
        r2Warning = 'Object was already missing from storage.';
      }
    } else if (!storageKey) {
      console.warn('[asset-delete] No storage_key/file_path; skipping R2 delete', { id });
      r2Warning = 'No storage key on record; skipped R2 delete.';
    }

    const clearPublishing = await supabase
      .from('publishing_schedules')
      .update({ asset_id: null })
      .eq('asset_id', asset.id)
      .eq('workspace_id', workspaceId);
    if (clearPublishing.error?.code === '42703') {
      await supabase
        .from('publishing_schedules')
        .update({ asset_id: null })
        .eq('asset_id', asset.id);
    } else if (clearPublishing.error && clearPublishing.error.code !== '42P01') {
      return NextResponse.json(
        { success: false, error: clearPublishing.error.message, code: 'DEPENDENCY_UPDATE_FAILED' },
        { status: 500 },
      );
    }

    const deleteTaskAssetLinks = await supabase
      .from('task_asset_links')
      .delete()
      .eq('asset_id', asset.id);
    if (deleteTaskAssetLinks.error && deleteTaskAssetLinks.error.code !== '42P01') {
      return NextResponse.json(
        {
          success: false,
          error: deleteTaskAssetLinks.error.message,
          code: 'DEPENDENCY_DELETE_FAILED',
        },
        { status: 500 },
      );
    }

    const clearTaskAssetRefs = await supabase
      .from('tasks')
      .update({ asset_id: null })
      .eq('asset_id', asset.id)
      .eq('workspace_id', workspaceId);
    if (clearTaskAssetRefs.error?.code === '42703') {
      await supabase.from('tasks').update({ asset_id: null }).eq('asset_id', asset.id);
    } else if (clearTaskAssetRefs.error) {
      return NextResponse.json(
        {
          success: false,
          error: clearTaskAssetRefs.error.message,
          code: 'DEPENDENCY_UPDATE_FAILED',
        },
        { status: 500 },
      );
    }

    const nowIso = new Date().toISOString();
    const softPayloadFull = {
      is_deleted: true,
      deleted_at: nowIso,
      missing_in_storage: false,
      sync_status: 'synced',
      updated_at: nowIso,
    };
    const softPayloadLegacy = { is_deleted: true, updated_at: nowIso };

    let { error: dbError } = await supabase
      .from('assets')
      .update(softPayloadFull)
      .eq('id', id)
      .eq('workspace_id', workspaceId);

    if (dbError?.code === '42703' || dbError?.code === 'PGRST204') {
      ({ error: dbError } = await supabase
        .from('assets')
        .update(softPayloadLegacy)
        .eq('id', id)
        .eq('workspace_id', workspaceId));
    }

    if (dbError) {
      console.error('[asset-delete] DB soft-delete failed', {
        assetId: asset.id,
        error: dbError.message,
      });
      return NextResponse.json(
        { success: false, error: `Database update failed: ${dbError.message}` },
        { status: 500 },
      );
    }

    // eslint-disable-next-line no-console
    console.info('[debug-delete] route=/api/assets/[id] step=soft-deleted', {
      recordId: id,
      workspaceId,
      requesterUserId: auth.profile.id,
      membershipFound,
    });

    void supabase.from('activities').insert({
      workspace_id: workspaceId,
      type: 'asset_deleted',
      description: `Asset "${asset.name}" removed (R2 + soft delete)`,
      user_uuid: auth.profile.id,
      entity_type: 'asset',
      entity_id: id,
    });

    return NextResponse.json({
      success: true,
      message: r2Warning ? `Asset hidden. ${r2Warning}` : 'Asset deleted',
      ...(r2Warning ? { warning: r2Warning } : {}),
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Unexpected server error while deleting asset',
      },
      { status: 500 },
    );
  }
}

// ── PATCH /api/assets/[id] — rename ──────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, ['admin', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Missing asset id' }, { status: 400 });
  }

  let body: { name?: string };
  try {
    body = (await req.json()) as { name?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const newName = (body.name ?? '').trim();
  if (!newName) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (newName.length > 255) {
    return NextResponse.json({ error: 'name must be 255 characters or fewer' }, { status: 400 });
  }
  if (/[<>:"/\\|?*]/.test(newName)) {
    return NextResponse.json({ error: 'name contains invalid characters' }, { status: 400 });
  }

  const supabase = getServiceClient();

  // ── 1. Fetch the asset ─────────────────────────────────────────────────────
  const { data: asset, error: fetchError } = await supabase
    .from('assets')
    .select('id, name, storage_provider')
    .eq('id', id)
    .single();

  if (fetchError || !asset) {
    return NextResponse.json(
      { error: `Asset not found: ${fetchError?.message ?? 'unknown'}` },
      { status: 404 },
    );
  }

  // No-op if the name hasn't changed
  if (asset.name === newName) {
    return NextResponse.json({ success: true, message: 'Name unchanged.' });
  }

  // ── 2. Update DB record ────────────────────────────────────────────────────
  // R2 objects are identified by key (file_path) not name; only update the DB.
  const { error: dbError } = await supabase.from('assets').update({ name: newName }).eq('id', id);

  if (dbError) {
    console.error('[asset-rename] DB update failed', { assetId: asset.id, error: dbError.message });
    return NextResponse.json(
      { error: `Database update failed: ${dbError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    message: 'Asset renamed successfully.',
    name: newName,
  });
}
