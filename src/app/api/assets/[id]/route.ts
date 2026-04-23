import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { getApiUser, requireRole } from '@/lib/api-auth';
import { deleteFile, R2NotFoundError, R2ConfigError } from '@/lib/storage';

// ── DELETE /api/assets/[id] ───────────────────────────────────────────────────
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Auth: only owner and admin may delete assets.
  const auth = await getApiUser(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const canDelete = auth.profile.role === 'owner' || auth.profile.role === 'admin';
  if (!canDelete) {
    console.warn('[asset-delete] unauthorized delete attempt', {
      userId: auth.profile.id,
      email: auth.profile.email,
      role: auth.profile.role,
      assetId: id ?? 'unknown',
    });
    return NextResponse.json(
      { error: 'You do not have permission to delete this file' },
      { status: 403 },
    );
  }

  if (!id) {
    return NextResponse.json({ error: 'Missing asset id' }, { status: 400 });
  }

  // ── Soft delete mode ──────────────────────────────────────────────────────
  // Pass ?soft=true to mark the asset as deleted without removing it from
  // storage or the database.  Useful when you want a recycle-bin workflow.
  const { searchParams } = new URL(req.url);
  const softDelete = searchParams.get('soft') === 'true';

  const supabase = getServiceClient();
  const { data: asset, error: fetchError } = await supabase
    .from('assets')
    .select('id, file_path, bucket_name, name, storage_provider')
    .eq('id', id)
    .single();

  if (fetchError || !asset) {
    return NextResponse.json(
      { error: `Asset not found: ${fetchError?.message ?? 'unknown'}` },
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
        { error: `Database update failed: ${dbError.message}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, message: 'Asset marked as deleted.', soft: true });
  }

  // ── 2. Delete from remote storage ────────────────────────────────────────
  let warning: string | undefined;

  const provider = asset.storage_provider as string | null;

  if (provider === 'r2') {
    // ── Cloudflare R2 delete ────────────────────────────────────────────────
    const filePath = asset.file_path as string | null;

    if (!filePath) {
      console.warn('[asset-delete] file_path missing for r2 asset – skipping R2 deletion', {
        assetId: asset.id,
      });
    } else {
      try {
        await deleteFile(filePath);
      } catch (err: unknown) {
        if (err instanceof R2NotFoundError) {
          warning = 'Asset record deleted. Remote R2 file was already missing.';
          console.warn('[asset-delete] R2 object not found – treating as orphaned', {
            assetId: asset.id,
            filePath,
          });
        } else if (err instanceof R2ConfigError) {
          warning =
            'Asset record deleted. R2 storage is not configured — remote file was not removed.';
          console.error('[asset-delete] R2 config error – skipping R2 delete', {
            assetId: asset.id,
            filePath,
            error: (err as Error).message,
          });
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          warning = `Asset record deleted. R2 file removal failed: ${msg}`;
          console.error('[asset-delete] R2 delete failed (non-fatal)', {
            assetId: asset.id,
            filePath,
            error: msg,
          });
        }
      }
    }
  } else if (provider === 'supabase_storage') {
    // ── Legacy Supabase Storage delete ─────────────────────────────────────
    const filePath = asset.file_path as string | null;

    if (!filePath) {
      console.warn(
        '[asset-delete] file_path missing for supabase_storage asset – skipping storage deletion',
        {
          assetId: asset.id,
        },
      );
    } else {
      const bucketName = (asset.bucket_name as string | null) ?? 'client-assets';
      const { error: storageError } = await supabase.storage.from(bucketName).remove([filePath]);

      if (storageError) {
        if (storageError.message.toLowerCase().includes('not found')) {
          warning = 'Asset record deleted. Remote file was already missing.';
          console.warn('[asset-delete] Storage file not found – treating as orphaned', {
            assetId: asset.id,
            filePath,
            error: storageError.message,
          });
        } else {
          console.error('[asset-delete] Storage delete failed', {
            assetId: asset.id,
            filePath,
            error: storageError.message,
          });
          return NextResponse.json(
            { error: `Storage delete failed: ${storageError.message}` },
            { status: 502 },
          );
        }
      }
    }
  } else {
    // Unknown or null provider — skip remote deletion
    console.warn('[asset-delete] unknown storage_provider — skipping remote deletion', {
      assetId: asset.id,
      provider,
    });
  }

  // ── 3. Delete row from assets table ──────────────────────────────────────
  const { error: dbError } = await supabase.from('assets').delete().eq('id', id);
  if (dbError) {
    console.error('[asset-delete] DB delete failed', { assetId: asset.id, error: dbError.message });
    return NextResponse.json(
      { error: `Database delete failed: ${dbError.message}` },
      { status: 500 },
    );
  }

  const successMessage = warning ?? 'Asset deleted successfully.';
  return NextResponse.json({
    success: true,
    message: successMessage,
    ...(warning ? { warning } : {}),
  });
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
