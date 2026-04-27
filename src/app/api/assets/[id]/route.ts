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

function extractR2Key(asset: AssetRow): string | null {
  const direct = (asset.storage_key ?? asset.file_path ?? '').trim();
  if (direct) return direct.replace(/^\/+/, '');

  const candidates = [asset.file_url, asset.preview_url, asset.download_url].filter(
    (value): value is string => Boolean(value),
  );
  if (candidates.length === 0) return null;

  const base = (process.env.R2_PUBLIC_URL ?? '').trim().replace(/\/+$/, '');
  for (const candidate of candidates) {
    const url = candidate.trim();
    if (!url) continue;
    if (base && url.startsWith(base + '/')) {
      const key = url.slice(base.length + 1).replace(/^\/+/, '');
      return key ? decodeURIComponent(key) : null;
    }
    try {
      const parsed = new URL(url);
      const pathKey = parsed.pathname.replace(/^\/+/, '');
      if (pathKey) return decodeURIComponent(pathKey);
    } catch {
      // Ignore malformed URL strings and continue trying.
    }
  }
  return null;
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

    // ── Soft delete mode ──────────────────────────────────────────────────────
    // Pass ?soft=true to mark the asset as deleted without removing it from
    // storage or the database.  Useful when you want a recycle-bin workflow.
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

    // ── 2a. Soft delete — mark as deleted without touching storage ────────────
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

    // ── 2. Delete R2 object first (key-only, no download) ────────────────────
    const r2Key = extractR2Key(asset as AssetRow);
    if (!r2Key) {
      return NextResponse.json(
        {
          success: false,
          error: 'R2 deletion failed. Check R2 configuration.',
          code: 'R2_KEY_MISSING',
        },
        { status: 500 },
      );
    }

    const r2Delete = await deleteR2Object(r2Key);
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
          error: r2Delete.error ?? 'R2 deletion failed. Check R2 configuration.',
          code: 'R2_DELETE_FAILED',
        },
        { status: 500 },
      );
    }

    // ── 3. Delete dependent rows first (workspace-scoped when possible) ─────
    const deletePublishingSchedules = await supabase
      .from('publishing_schedules')
      .delete()
      .eq('asset_id', asset.id)
      .eq('workspace_id', workspaceId);
    if (deletePublishingSchedules.error?.code === '42703') {
      const legacyDelete = await supabase
        .from('publishing_schedules')
        .delete()
        .eq('asset_id', asset.id);
      if (legacyDelete.error) {
        return NextResponse.json(
          { success: false, error: legacyDelete.error.message, code: 'DEPENDENCY_DELETE_FAILED' },
          { status: 500 },
        );
      }
    } else if (deletePublishingSchedules.error) {
      return NextResponse.json(
        {
          success: false,
          error: deletePublishingSchedules.error.message,
          code: 'DEPENDENCY_DELETE_FAILED',
        },
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
      const legacyClear = await supabase
        .from('tasks')
        .update({ asset_id: null })
        .eq('asset_id', asset.id);
      if (legacyClear.error && legacyClear.error.code !== '42703') {
        return NextResponse.json(
          { success: false, error: legacyClear.error.message, code: 'DEPENDENCY_DELETE_FAILED' },
          { status: 500 },
        );
      }
    } else if (clearTaskAssetRefs.error) {
      return NextResponse.json(
        {
          success: false,
          error: clearTaskAssetRefs.error.message,
          code: 'DEPENDENCY_DELETE_FAILED',
        },
        { status: 500 },
      );
    }

    const deleteComments = await supabase.from('comments').delete().eq('asset_id', asset.id);
    if (deleteComments.error && deleteComments.error.code !== '42P01') {
      return NextResponse.json(
        { success: false, error: deleteComments.error.message, code: 'DEPENDENCY_DELETE_FAILED' },
        { status: 500 },
      );
    }

    const deleteActivities = await supabase
      .from('activities')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('entity_type', 'asset')
      .eq('entity_id', asset.id);
    if (deleteActivities.error && deleteActivities.error.code !== '42703') {
      return NextResponse.json(
        { success: false, error: deleteActivities.error.message, code: 'DEPENDENCY_DELETE_FAILED' },
        { status: 500 },
      );
    }

    let warning: string | undefined;
    if (r2Delete.missing) {
      warning = 'Asset deleted. R2 object was already missing.';
    }

    // ── 4. Delete asset row ──────────────────────────────────────────────────
    const { error: dbError } = await supabase
      .from('assets')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId);
    if (dbError) {
      console.error('[asset-delete] DB delete failed', {
        assetId: asset.id,
        error: dbError.message,
      });
      return NextResponse.json(
        { success: false, error: `Database delete failed: ${dbError.message}` },
        { status: 500 },
      );
    }

    void supabase.from('activities').insert({
      workspace_id: workspaceId,
      type: 'asset_deleted',
      description: `Asset "${asset.name}" deleted`,
      user_uuid: auth.profile.id,
      entity_type: 'asset',
      entity_id: id,
    });

    return NextResponse.json({
      success: true,
      message: warning ?? 'Asset deleted',
      ...(warning ? { warning } : {}),
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
