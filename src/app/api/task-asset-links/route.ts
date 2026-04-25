/**
 * GET /api/task-asset-links
 *   List asset links for a task (or tasks for an asset).
 *   Query params:
 *     task_id  — required (or asset_id)
 *     asset_id — required (or task_id)
 *
 * POST /api/task-asset-links
 *   Link one or more assets to a task.
 *   Body: { task_id, asset_ids: string[] }
 *
 * DELETE /api/task-asset-links
 *   Unlink an asset from a task.
 *   Body: { task_id, asset_id }
 *
 * Auth: admin | manager | team
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get('task_id');
  const assetId = searchParams.get('asset_id');

  if (!taskId && !assetId) {
    return NextResponse.json(
      { success: false, error: 'Either task_id or asset_id is required' },
      { status: 400 },
    );
  }

  try {
    const db = getServiceClient();

    let query = db
      .from('task_asset_links')
      .select(
        `
        task_id, asset_id, linked_at, linked_by,
        asset:assets(id, name, content_type, web_view_link, preview_url, mime_type, file_size)
      `,
      )
      .order('linked_at', { ascending: false });

    if (taskId) query = query.eq('task_id', taskId);
    if (assetId) query = query.eq('asset_id', assetId);

    const { data, error } = await query;

    if (error) {
      console.error('[GET /api/task-asset-links] error:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, links: data ?? [] });
  } catch (err) {
    console.error('[GET /api/task-asset-links] unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const taskId = typeof body.task_id === 'string' ? body.task_id.trim() : '';
  if (!taskId) {
    return NextResponse.json({ success: false, error: 'task_id is required' }, { status: 400 });
  }

  const assetIds: string[] = [];
  if (Array.isArray(body.asset_ids)) {
    for (const id of body.asset_ids) {
      if (typeof id === 'string' && id.trim()) assetIds.push(id.trim());
    }
  }
  // Also accept single asset_id
  if (typeof body.asset_id === 'string' && body.asset_id.trim()) {
    const singleId = body.asset_id.trim();
    if (!assetIds.includes(singleId)) assetIds.push(singleId);
  }

  if (assetIds.length === 0) {
    return NextResponse.json(
      { success: false, error: 'asset_ids (array) or asset_id is required' },
      { status: 400 },
    );
  }

  try {
    const db = getServiceClient();

    const linkRows = assetIds.map((aid) => ({
      task_id: taskId,
      asset_id: aid,
      linked_by: auth.profile.id ?? null,
    }));

    const { data, error } = await db
      .from('task_asset_links')
      .upsert(linkRows, { onConflict: 'task_id,asset_id' })
      .select('task_id, asset_id, linked_at, linked_by');

    if (error) {
      console.error('[POST /api/task-asset-links] db error:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Update assets.status to 'linked' and backfill task_id
    void db
      .from('assets')
      .update({ task_id: taskId, status: 'linked' })
      .in('id', assetIds)
      .then(({ error: aErr }) => {
        if (aErr) console.warn('[POST /api/task-asset-links] asset update failed:', aErr.message);
      });

    return NextResponse.json({ success: true, links: data ?? [] }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/task-asset-links] unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const taskId = typeof body.task_id === 'string' ? body.task_id.trim() : '';
  const assetId = typeof body.asset_id === 'string' ? body.asset_id.trim() : '';

  if (!taskId || !assetId) {
    return NextResponse.json(
      { success: false, error: 'task_id and asset_id are both required' },
      { status: 400 },
    );
  }

  try {
    const db = getServiceClient();

    const { error } = await db
      .from('task_asset_links')
      .delete()
      .eq('task_id', taskId)
      .eq('asset_id', assetId);

    if (error) {
      console.error('[DELETE /api/task-asset-links] error:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // If this asset has no other task links, reset its status to 'ready'
    void db
      .from('task_asset_links')
      .select('task_id', { count: 'exact', head: true })
      .eq('asset_id', assetId)
      .then(async ({ count }) => {
        if ((count ?? 0) === 0) {
          await db.from('assets').update({ status: 'ready', task_id: null }).eq('id', assetId);
        }
      });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/task-asset-links] unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
