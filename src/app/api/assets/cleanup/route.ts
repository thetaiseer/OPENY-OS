import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { fileExists, getStorageConfigStatus } from '@/lib/storage';

type AssetRow = { id: string; name: string; file_path: string | null };

// Check which R2 object keys are missing (HeadObject 404), 20 at a time
async function findOrphanedIds(assets: AssetRow[]): Promise<string[]> {
  const { configured } = getStorageConfigStatus();
  if (!configured) return [];

  const orphanedIds: string[] = [];
  const CONCURRENCY = 20;

  for (let i = 0; i < assets.length; i += CONCURRENCY) {
    const batch = assets.slice(i, i + CONCURRENCY);
    await Promise.allSettled(
      batch.map(async (asset) => {
        if (!asset.file_path) return;
        try {
          const exists = await fileExists(asset.file_path);
          if (!exists) orphanedIds.push(asset.id);
        } catch {
          // Skip transient / auth errors to avoid false positives
        }
      }),
    );
  }

  return orphanedIds;
}

/**
 * GET /api/assets/cleanup
 * Find DB asset records whose R2 object is confirmed missing.
 * Admin only.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin']);
  if (auth instanceof NextResponse) return auth;

  const { configured, missingVars } = getStorageConfigStatus();
  if (!configured) {
    return NextResponse.json(
      { error: `R2 storage not configured. Missing: ${missingVars.join(', ')}` },
      { status: 500 },
    );
  }

  const supabase = getServiceClient();
  const { data: assets, error } = await supabase
    .from('assets')
    .select('id, name, file_path')
    .eq('storage_provider', 'r2')
    .not('file_path', 'is', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const list = (assets ?? []) as AssetRow[];
  const orphanedIds = await findOrphanedIds(list);
  const orphaned = list
    .filter((a) => orphanedIds.includes(a.id))
    .map((a) => ({ id: a.id, name: a.name, file_path: a.file_path }));

  return NextResponse.json({ orphaned, total: list.length, orphanedCount: orphaned.length });
}

/**
 * DELETE /api/assets/cleanup
 * Delete DB records whose R2 object is confirmed missing.
 * Admin only.
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireRole(req, ['admin']);
  if (auth instanceof NextResponse) return auth;

  const { configured, missingVars } = getStorageConfigStatus();
  if (!configured) {
    return NextResponse.json(
      { error: `R2 storage not configured. Missing: ${missingVars.join(', ')}` },
      { status: 500 },
    );
  }

  const supabase = getServiceClient();
  const { data: assets, error } = await supabase
    .from('assets')
    .select('id, name, file_path')
    .eq('storage_provider', 'r2')
    .not('file_path', 'is', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const list = (assets ?? []) as AssetRow[];
  const orphanedIds = await findOrphanedIds(list);

  if (orphanedIds.length > 0) {
    const { error: deleteError } = await supabase.from('assets').delete().in('id', orphanedIds);

    if (deleteError) {
      return NextResponse.json(
        {
          error: `Failed to delete orphaned records: ${deleteError.message}`,
          attempted: orphanedIds,
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ deleted: orphanedIds.length, ids: orphanedIds });
}
