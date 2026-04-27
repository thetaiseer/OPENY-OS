/**
 * POST /api/assets/sync-r2
 *
 * Scans all active (non-deleted) asset records that have a storage_key and
 * verifies whether the corresponding R2 object still exists.
 *
 * For each asset whose R2 object is missing:
 *   - Sets missing_in_storage = true
 *   - Sets sync_status = 'missing'
 *
 * For each asset whose R2 object exists:
 *   - Sets missing_in_storage = false
 *   - Sets sync_status = 'synced'
 *
 * Auth: owner or admin only.
 * Also callable by cron via CRON_SECRET header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { objectExists } from '@/lib/storage/r2';

const CRON_SECRET = process.env.CRON_SECRET ?? '';
const BATCH_SIZE = 50;

function isCronRequest(req: NextRequest): boolean {
  if (!CRON_SECRET) return false;
  const auth = req.headers.get('authorization') ?? '';
  return auth === `Bearer ${CRON_SECRET}`;
}

export async function POST(req: NextRequest) {
  // Allow cron jobs or authenticated admin/owner users.
  if (!isCronRequest(req)) {
    const auth = await requireRole(req, ['owner', 'admin']);
    if (auth instanceof NextResponse) return auth;
  }

  const db = getServiceClient();

  // Fetch all active assets that have a storage_key (only R2-backed assets).
  const { data: assets, error: fetchError } = await db
    .from('assets')
    .select('id, storage_key, name, workspace_id')
    .neq('is_deleted', true)
    .is('deleted_at', null)
    .not('storage_key', 'is', null)
    .neq('storage_key', '');

  if (fetchError) {
    console.error('[sync-r2] fetch error', fetchError.message);
    return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 });
  }

  const rows = (assets ?? []) as {
    id: string;
    storage_key: string;
    name: string;
    workspace_id: string | null;
  }[];

  if (rows.length === 0) {
    return NextResponse.json({ success: true, checked: 0, missing: 0, synced: 0 });
  }

  let checked = 0;
  let missing = 0;
  let synced = 0;
  const errors: string[] = [];

  // Process in batches to avoid overwhelming R2 or hitting memory limits.
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (asset) => {
        checked++;
        const key = (asset.storage_key ?? '').trim().replace(/^\/+/, '');
        if (!key) return;

        const result = await objectExists(key);

        if (result.configMissing) {
          // R2 not configured — skip the whole batch.
          errors.push('R2 not configured');
          return;
        }

        if (result.error) {
          errors.push(`[${asset.id}] ${result.error}`);
          return;
        }

        if (!result.exists) {
          missing++;
          const { error: updateError } = await db
            .from('assets')
            .update({ missing_in_storage: true, sync_status: 'missing' })
            .eq('id', asset.id);
          if (updateError) {
            errors.push(`[${asset.id}] update failed: ${updateError.message}`);
          }
        } else {
          synced++;
          // Only update if currently marked as missing to avoid noisy writes.
          const { error: updateError } = await db
            .from('assets')
            .update({ missing_in_storage: false, sync_status: 'synced' })
            .eq('id', asset.id)
            .eq('missing_in_storage', true);
          if (updateError && updateError.code !== '42703') {
            errors.push(`[${asset.id}] update failed: ${updateError.message}`);
          }
        }
      }),
    );
  }

  if (errors.length > 0) {
    // Deduplicate (e.g. repeated "R2 not configured")
    const unique = [...new Set(errors)];
    // eslint-disable-next-line no-console
    console.warn('[sync-r2] completed with errors', { checked, missing, synced, errors: unique });
    return NextResponse.json({
      success: true,
      checked,
      missing,
      synced,
      errors: unique,
    });
  }

  // eslint-disable-next-line no-console
  console.info('[sync-r2] completed', { checked, missing, synced });
  return NextResponse.json({ success: true, checked, missing, synced });
}
