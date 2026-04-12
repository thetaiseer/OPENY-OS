import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/api-auth';

// ── Supabase service-role client (server only) ────────────────────────────────
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

// ── DELETE /api/assets/[id] ───────────────────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Auth: only admin and team members may delete assets.
  const auth = await requireRole(req, ['admin', 'team']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Missing asset id' }, { status: 400 });
  }

  const supabase = getSupabase();

  // ── 1. Fetch asset row ────────────────────────────────────────────────────
  const { data: asset, error: fetchError } = await supabase
    .from('assets')
    .select('id, drive_file_id, drive_folder_id, file_path, bucket_name, name, storage_provider')
    .eq('id', id)
    .single();

  if (fetchError || !asset) {
    return NextResponse.json(
      { error: `Asset not found: ${fetchError?.message ?? 'unknown'}` },
      { status: 404 },
    );
  }

  console.log('[asset-delete] starting delete', {
    assetId: asset.id,
    driveFileId: asset.drive_file_id ?? null,
    driveFolderId: asset.drive_folder_id ?? null,
    storageProvider: asset.storage_provider,
  });

  // ── 2. Delete from remote storage ────────────────────────────────────────
  let warning: string | undefined;

  if (asset.storage_provider === 'supabase_storage') {
    // ── Supabase Storage delete ─────────────────────────────────────────────
    const filePath   = asset.file_path as string | null;

    if (!filePath) {
      console.warn('[asset-delete] file_path missing for supabase_storage asset – skipping storage deletion', {
        assetId: asset.id,
      });
    } else {
      const { error: storageError } = await supabase.storage
        .from("assets")
        .remove([filePath]);

      if (storageError) {
        // Treat "not found" as an orphaned record and continue with DB delete.
        if (storageError.message.toLowerCase().includes('not found')) {
          warning = 'Asset record deleted. Remote file was already missing.';
          console.warn('[asset-delete] Storage file not found – treating as orphaned', {
            assetId: asset.id,
            filePath,
            error: storageError.message,
          });
        } else {
          console.error('[asset-delete] Storage delete failed', { assetId: asset.id, filePath, error: storageError.message });
          return NextResponse.json(
            { error: `Storage delete failed: ${storageError.message}` },
            { status: 502 },
          );
        }
      } else {
        console.log('[asset-delete] Storage delete succeeded', { assetId: asset.id, filePath });
      }
    }
  } else if (asset.storage_provider === 'google_drive') {
    // ── Google Drive delete — BYPASSED (testing Supabase Storage only) ────────
    console.log('[ASSET DEBUG] Google Drive integration bypassed');
    console.log('[asset-delete] skipping Drive delete (bypassed for Supabase-only testing)', {
      assetId: asset.id,
      driveFileId: asset.drive_file_id ?? null,
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

  console.log('[asset-delete] DB delete succeeded', { assetId: asset.id });

  // ── 4. Clean up empty parent folders in Google Drive — BYPASSED ──────────
  // Google Drive folder cleanup is disabled for Supabase-only testing.
  if (asset.storage_provider === 'google_drive' && asset.drive_folder_id) {
    console.log('[ASSET DEBUG] Google Drive integration bypassed');
    console.log('[asset-delete] skipping Drive folder cleanup (bypassed for Supabase-only testing)', {
      assetId: asset.id,
      driveFolderId: asset.drive_folder_id,
    });
  }

  const successMessage = warning ?? 'Asset deleted successfully.';
  return NextResponse.json({ success: true, message: successMessage, ...(warning ? { warning } : {}) });
}

// ── PATCH /api/assets/[id] — rename ──────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(req, ['admin', 'team']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Missing asset id' }, { status: 400 });
  }

  let body: { name?: string };
  try {
    body = await req.json() as { name?: string };
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

  const supabase = getSupabase();

  // ── 1. Fetch the asset ─────────────────────────────────────────────────────
  const { data: asset, error: fetchError } = await supabase
    .from('assets')
    .select('id, name, drive_file_id, storage_provider')
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

  console.log('[asset-rename] starting rename', { assetId: asset.id, from: asset.name, to: newName });

  // ── 2. Rename in Google Drive — BYPASSED (testing Supabase Storage only) ──
  if (asset.storage_provider === 'google_drive' && asset.drive_file_id) {
    console.log('[ASSET DEBUG] Google Drive integration bypassed');
    console.log('[asset-rename] skipping Drive rename (bypassed for Supabase-only testing)', {
      assetId: asset.id,
      driveFileId: asset.drive_file_id,
    });
  }

  // ── 3. Update DB record ────────────────────────────────────────────────────
  const { error: dbError } = await supabase
    .from('assets')
    .update({ name: newName })
    .eq('id', id);

  if (dbError) {
    console.error('[asset-rename] DB update failed', { assetId: asset.id, error: dbError.message });
    return NextResponse.json(
      { error: `Database update failed: ${dbError.message}` },
      { status: 500 },
    );
  }

  console.log('[asset-rename] completed', { assetId: asset.id, name: newName });
  return NextResponse.json({ success: true, message: 'Asset renamed successfully.', name: newName });
}
