import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { getApiUser, requireRole } from '@/lib/api-auth';
import { deleteFromR2, R2NotFoundError, R2ConfigError } from '@/lib/r2';

const SUPABASE_ASSETS_BUCKET = 'openy-assets';
const SIGNED_URL_TTL_ONE_HOUR_SECONDS = 60 * 60;
const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;

type AssetForPreview = {
  id: string;
  name: string;
  file_path?: string | null;
  storage_key?: string | null;
  bucket_name?: string | null;
  storage_provider?: string | null;
  file_url?: string | null;
  download_url?: string | null;
  view_url?: string | null;
  web_view_link?: string | null;
  preview_url?: string | null;
  file_type?: string | null;
  mime_type?: string | null;
  main_category?: string | null;
  sub_category?: string | null;
  month_key?: string | null;
  client_name?: string | null;
};

function monthSegment(monthKey?: string | null) {
  if (!monthKey || !MONTH_KEY_PATTERN.test(monthKey)) return null;
  const [year, mm] = monthKey.split('-');
  const monthName = new Date(Date.UTC(parseInt(year, 10), parseInt(mm, 10) - 1, 1))
    .toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })
    .toLowerCase();
  return { year, segment: `${mm}-${monthName}` };
}

function normalizePath(value: string | null | undefined, bucket: string) {
  if (!value) return null;
  let trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    trimmed = decodeURIComponent(parsed.pathname);
  } catch {
    // keep as-is when not a URL
  }

  const publicPrefix = `/storage/v1/object/public/${bucket}/`;
  const signPrefix = `/storage/v1/object/sign/${bucket}/`;
  if (trimmed.includes(publicPrefix)) trimmed = trimmed.split(publicPrefix)[1] ?? trimmed;
  if (trimmed.includes(signPrefix)) trimmed = trimmed.split(signPrefix)[1] ?? trimmed;
  if (trimmed.startsWith('/')) trimmed = trimmed.slice(1);
  if (trimmed.startsWith(`${bucket}/`)) trimmed = trimmed.slice(bucket.length + 1);
  if (!trimmed || trimmed === bucket) return null;
  return trimmed.split('?')[0] ?? null;
}

function clientSlug(name?: string | null) {
  if (!name) return null;
  return name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function uniquePush(list: string[], value: string | null) {
  if (!value) return;
  if (!list.includes(value)) list.push(value);
}

function buildPathCandidates(asset: AssetForPreview, bucket: string, preferred?: Array<string | null | undefined>) {
  const candidates: string[] = [];
  const seedValues = preferred ?? [
    asset.storage_key,
    asset.file_path,
    asset.file_url,
    asset.download_url,
    asset.view_url,
    asset.web_view_link,
    asset.preview_url,
  ];
  seedValues.forEach((value) => uniquePush(candidates, normalizePath(value ?? null, bucket)));

  const baseName = (normalizePath(asset.storage_key ?? asset.file_path ?? asset.file_url ?? null, bucket) ?? '').split('/').pop();
  const slug = clientSlug(asset.client_name);
  const month = monthSegment(asset.month_key);
  const main = asset.main_category?.trim() || 'other';
  const sub = asset.sub_category?.trim() || 'general';
  if (baseName && slug && month) {
    uniquePush(candidates, `clients/${slug}/${main}/${month.year}/${month.segment}/${sub}/${baseName}`);
  }

  return candidates;
}

async function isBucketPublic(supabase: ReturnType<typeof getServiceClient>, bucket: string) {
  const { data } = await supabase
    .schema('storage')
    .from('buckets')
    .select('public')
    .eq('id', bucket)
    .maybeSingle();
  return Boolean(data?.public);
}

async function resolveStorageUrl(
  supabase: ReturnType<typeof getServiceClient>,
  bucket: string,
  bucketPublic: boolean,
  candidates: string[],
) {
  for (const path of candidates) {
    const { data: signedData, error: signedErr } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, SIGNED_URL_TTL_ONE_HOUR_SECONDS);
    if (signedErr || !signedData?.signedUrl) continue;
    if (bucketPublic) {
      const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);
      if (publicData?.publicUrl) return { path, url: publicData.publicUrl };
    }
    return { path, url: signedData.signedUrl };
  }
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getApiUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const supabase = getServiceClient();
  const { data: asset, error } = await supabase
    .from('assets')
    .select('id,name,file_path,storage_key,bucket_name,storage_provider,file_url,download_url,view_url,web_view_link,preview_url,file_type,mime_type,main_category,sub_category,month_key,client_name,file_size')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  const provider = (asset.storage_provider ?? '').toLowerCase();
  if (provider !== 'supabase_storage' && provider !== 'supabase') {
    return NextResponse.json({ asset });
  }

  const bucket = SUPABASE_ASSETS_BUCKET;
  const bucketPublic = await isBucketPublic(supabase, bucket);
  const fileResolved = await resolveStorageUrl(
    supabase,
    bucket,
    bucketPublic,
    buildPathCandidates(asset as AssetForPreview, bucket),
  );
  const previewResolved = await resolveStorageUrl(
    supabase,
    bucket,
    bucketPublic,
    buildPathCandidates(asset as AssetForPreview, bucket, [asset.preview_url]),
  );

  return NextResponse.json({
    asset: {
      ...asset,
      bucket_name: bucket,
      ...(fileResolved
        ? {
            file_url: fileResolved.url,
            download_url: fileResolved.url,
            view_url: fileResolved.url,
            web_view_link: fileResolved.url,
            file_path: fileResolved.path,
            storage_key: fileResolved.path,
          }
        : null),
      ...(previewResolved ? { preview_url: previewResolved.url } : null),
    },
  });
}

// ── DELETE /api/assets/[id] ───────────────────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
      email:  auth.profile.email,
      role:   auth.profile.role,
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
      console.error('[asset-delete] soft delete DB update failed', { assetId: asset.id, error: dbError.message });
      return NextResponse.json(
        { error: `Database update failed: ${dbError.message}` },
        { status: 500 },
      );
    }

    console.log('[asset-delete] soft delete succeeded', {
      assetId:   asset.id,
      deletedBy: auth.profile.email,
    });
    return NextResponse.json({ success: true, message: 'Asset marked as deleted.', soft: true });
  }

  console.log('[asset-delete] starting delete', {
    assetId:         asset.id,
    storageProvider: asset.storage_provider,
    filePath:        asset.file_path ?? null,
    deletedBy:       auth.profile.email,
  });

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
        await deleteFromR2(filePath);
        console.log('[asset-delete] R2 delete succeeded', { assetId: asset.id, filePath });
      } catch (err: unknown) {
        if (err instanceof R2NotFoundError) {
          warning = 'Asset record deleted. Remote R2 file was already missing.';
          console.warn('[asset-delete] R2 object not found – treating as orphaned', {
            assetId: asset.id,
            filePath,
          });
        } else if (err instanceof R2ConfigError) {
          warning = 'Asset record deleted. R2 storage is not configured — remote file was not removed.';
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
      console.warn('[asset-delete] file_path missing for supabase_storage asset – skipping storage deletion', {
        assetId: asset.id,
      });
    } else {
      const bucketName = (asset.bucket_name as string | null) ?? SUPABASE_ASSETS_BUCKET;
      const { error: storageError } = await supabase.storage
        .from(bucketName)
        .remove([filePath]);

      if (storageError) {
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

  console.log('[asset-delete] DB delete succeeded', { assetId: asset.id, deletedBy: auth.profile.email });

  const successMessage = warning ?? 'Asset deleted successfully.';
  return NextResponse.json({ success: true, message: successMessage, ...(warning ? { warning } : {}) });
}

// ── PATCH /api/assets/[id] — rename ──────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(req, ['admin', 'team_member']);
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

  console.log('[asset-rename] renaming in DB only', { assetId: asset.id, from: asset.name, to: newName });

  // ── 2. Update DB record ────────────────────────────────────────────────────
  // R2 objects are identified by key (file_path) not name; only update the DB.
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
