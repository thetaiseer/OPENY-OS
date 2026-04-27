import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { checkR2Config } from '@/lib/r2';
import { deleteR2Object } from '@/lib/storage/r2';

// Seconds to wait before hard-purging from R2 after soft-delete (0 = immediate).
// Set to 0 for now; raise to e.g. 86400 if you want a recycle-bin window.
const HARD_PURGE_DELAY_SECONDS = 0;

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
      return url.slice(base.length + 1).replace(/^\/+/, '') || null;
    }
    try {
      const parsed = new URL(url);
      const pathKey = parsed.pathname.replace(/^\/+/, '');
      if (pathKey) return pathKey;
    } catch {
      // Ignore malformed URL strings and continue trying.
    }
  }
  return null;
}

// ── DELETE /api/assets/[id] ───────────────────────────────────────────────────
/**
 * Soft-deletes the asset DB record and immediately purges the object from R2.
 *
 * Strategy:
 *   1. Fetch the asset row (id only, then storage_key for R2).
 *   2. Mark the DB record soft-deleted: is_deleted=true, deleted_at=now().
 *      The record disappears from all list queries immediately.
 *   3. Purge from R2 using storage_key only (never rely on public URL).
 *      R2 "not found" is treated as success (idempotent).
 *   4. Hard-delete the DB row + related rows (activities, comments, etc.)
 *      after HARD_PURGE_DELAY_SECONDS.  Currently 0 → immediate hard-delete.
 *
 * Never blocks deletion because R2 is missing/misconfigured.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireRole(req, ['owner', 'admin', 'manager']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing asset id' }, { status: 400 });
    }

    const supabase = getServiceClient();

    // ── 1. Fetch asset ────────────────────────────────────────────────────────
    let asset: AssetRow | null = null;
    let fetchError: { code?: string; message?: string } | null = null;

    const primary = await supabase
      .from('assets')
      .select(
        'id, workspace_id, file_path, storage_key, bucket_name, name, storage_provider, file_url, preview_url, download_url',
      )
      .eq('id', id)
      .maybeSingle();
    asset = primary.data as AssetRow | null;
    fetchError = primary.error;

    if (fetchError?.code === '42703') {
      // Schema drift — retry with minimal columns.
      const fallback = await supabase
        .from('assets')
        .select('id, workspace_id, file_path, storage_key, bucket_name, name, file_url')
        .eq('id', id)
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

    // ── 2. Soft-delete DB record immediately ──────────────────────────────────
    const now = new Date().toISOString();
    const { error: softDeleteError } = await supabase
      .from('assets')
      .update({ is_deleted: true, deleted_at: now, sync_status: 'deleted' })
      .eq('id', id);

    if (softDeleteError) {
      // Column might not exist yet in older schemas — fall through to hard delete.
      if (softDeleteError.code !== '42703') {
        console.error('[asset-delete] soft-delete update failed', {
          assetId: asset.id,
          error: softDeleteError.message,
        });
        return NextResponse.json(
          { success: false, error: `Database update failed: ${softDeleteError.message}` },
          { status: 500 },
        );
      }
    }

    // ── 3. Purge from R2 using storage_key only ───────────────────────────────
    let r2Warning: string | undefined;
    const r2Key = (asset.storage_key ?? '').trim().replace(/^\/+/, '') || null;

    if (r2Key) {
      const r2Delete = await deleteR2Object(r2Key);
      if (!r2Delete.success) {
        if (r2Delete.configMissing) {
          r2Warning = 'R2 storage is not configured — remote file was not removed.';
        } else {
          r2Warning = `R2 file removal failed: ${r2Delete.error ?? 'unknown error'}`;
        }
        console.warn('[asset-delete] non-fatal R2 cleanup issue', {
          assetId: asset.id,
          r2Key,
          error: r2Delete.error ?? null,
          configMissing: Boolean(r2Delete.configMissing),
        });
      } else if (r2Delete.missing) {
        r2Warning = 'Remote R2 file was already missing.';
      }
    } else {
      // No storage_key — try fallback path derivation for legacy supabase_storage assets.
      const provider = asset.storage_provider as string | null;
      if (provider === 'supabase_storage') {
        const rawFilePath = asset.file_path as string | null;
        const filePath = rawFilePath ? rawFilePath.replace(/^\/+/, '') : null;
        if (filePath) {
          const bucketName = ((asset.bucket_name as string | null) ?? 'client-assets').trim();
          const { error: storageError } = await supabase.storage
            .from(bucketName)
            .remove([filePath]);
          if (storageError && !storageError.message.toLowerCase().includes('not found')) {
            r2Warning = `Supabase storage removal failed: ${storageError.message}`;
          }
        } else {
          console.warn(
            '[asset-delete] no storage_key and no file_path — skipping storage removal',
            {
              assetId: asset.id,
            },
          );
        }
      } else {
        // R2 without a storage_key — try extractR2Key as last resort.
        const legacyKey = extractR2Key(asset);
        if (legacyKey && checkR2Config().configured) {
          const r2Delete = await deleteR2Object(legacyKey);
          if (!r2Delete.success && !r2Delete.configMissing) {
            r2Warning = `R2 file removal failed: ${r2Delete.error ?? 'unknown error'}`;
          }
        } else {
          console.warn('[asset-delete] no resolvable storage key — skipping R2 removal', {
            assetId: asset.id,
            provider,
          });
        }
      }
    }

    // ── 4. Hard-delete DB record + related rows ───────────────────────────────
    if (HARD_PURGE_DELAY_SECONDS === 0) {
      // Clean up related rows (best-effort — schema drift errors are silenced).
      const cleanups = await Promise.allSettled([
        supabase.from('publishing_schedules').delete().eq('asset_id', asset.id),
        supabase.from('task_asset_links').delete().eq('asset_id', asset.id),
        supabase.from('tasks').update({ asset_id: null }).eq('asset_id', asset.id),
        supabase.from('comments').delete().eq('asset_id', asset.id),
        supabase.from('activities').delete().eq('entity_type', 'asset').eq('entity_id', asset.id),
      ]);
      for (const result of cleanups) {
        if (result.status === 'fulfilled' && result.value.error) {
          const code = result.value.error.code;
          // Ignore missing table/column errors — schema drift is non-fatal.
          if (code !== '42703' && code !== '42P01') {
            console.warn('[asset-delete] cleanup warning', { error: result.value.error.message });
          }
        }
      }

      const { error: dbError } = await supabase.from('assets').delete().eq('id', id);
      if (dbError) {
        console.error('[asset-delete] DB hard-delete failed', {
          assetId: asset.id,
          error: dbError.message,
        });
        // Soft-delete already succeeded — return success with a warning.
        return NextResponse.json({
          success: true,
          message: 'Asset soft-deleted; hard-delete deferred.',
          ...(r2Warning ? { warning: r2Warning } : {}),
        });
      }
    }

    // Audit log (fire-and-forget).
    void supabase.from('activities').insert({
      workspace_id: asset.workspace_id,
      type: 'asset_deleted',
      description: `Asset "${asset.name}" deleted`,
      user_uuid: auth.profile.id,
      entity_type: 'asset',
      entity_id: id,
    });

    return NextResponse.json({
      success: true,
      message: r2Warning ? `Asset deleted. ${r2Warning}` : 'Asset deleted successfully.',
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
