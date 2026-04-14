/**
 * GET /api/approvals
 *   List approvals with optional filters.
 *   Query params: client_id, status, task_id, asset_id, content_item_id
 *
 * POST /api/approvals
 *   Create a new approval record.
 *   Body: { client_id?, task_id?, asset_id?, content_item_id?, reviewer_id?, notes?, status? }
 *
 * Auth: admin | manager | team
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { notifyApprovalRequested } from '@/lib/notification-service';


const VALID_STATUSES = ['pending', 'approved', 'rejected'] as const;

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const clientId      = searchParams.get('client_id');
  const status        = searchParams.get('status');
  const taskId        = searchParams.get('task_id');
  const assetId       = searchParams.get('asset_id');
  const contentItemId = searchParams.get('content_item_id');

  try {
    const db = getServiceClient();

    let query = db
      .from('approvals')
      .select(`
        *,
        client:clients(id, name),
        reviewer:team_members(id, full_name, email, avatar),
        task:tasks(id, title),
        asset:assets(id, name),
        content_item:content_items(id, title)
      `)
      .order('created_at', { ascending: false });

    if (clientId)      query = query.eq('client_id', clientId);
    if (status)        query = query.eq('status', status);
    if (taskId)        query = query.eq('task_id', taskId);
    if (assetId)       query = query.eq('asset_id', assetId);
    if (contentItemId) query = query.eq('content_item_id', contentItemId);

    const { data, error } = await query;

    if (error) {
      console.error('[GET /api/approvals] error:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, approvals: data ?? [] });
  } catch (err) {
    console.error('[GET /api/approvals] unexpected error:', err);
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

  // At least one of task_id / asset_id / content_item_id must be provided
  const taskId        = typeof body.task_id         === 'string' ? body.task_id.trim()         : '';
  const assetId       = typeof body.asset_id        === 'string' ? body.asset_id.trim()        : '';
  const contentItemId = typeof body.content_item_id === 'string' ? body.content_item_id.trim() : '';

  if (!taskId && !assetId && !contentItemId) {
    return NextResponse.json(
      { success: false, error: 'One of task_id, asset_id, or content_item_id is required' },
      { status: 400 },
    );
  }

  const clientId   = typeof body.client_id   === 'string' ? body.client_id.trim()   : '';
  const reviewerId = typeof body.reviewer_id === 'string' ? body.reviewer_id.trim() : '';
  const notes      = typeof body.notes       === 'string' ? body.notes.trim()       : '';
  const rawStatus  = typeof body.status      === 'string' ? body.status             : 'pending';
  const status     = (VALID_STATUSES as readonly string[]).includes(rawStatus) ? rawStatus : 'pending';

  const insertPayload: Record<string, unknown> = {
    status,
    client_id:        clientId        || null,
    task_id:          taskId          || null,
    asset_id:         assetId         || null,
    content_item_id:  contentItemId   || null,
    reviewer_id:      reviewerId      || auth.profile.id,
    notes:            notes           || null,
  };

  if (status === 'approved') insertPayload.approved_at = new Date().toISOString();
  if (status === 'rejected') insertPayload.rejected_at = new Date().toISOString();

  try {
    const db = getServiceClient();

    const { data, error } = await db
      .from('approvals')
      .insert(insertPayload)
      .select('*, client:clients(id,name), reviewer:team_members(id,full_name,email,avatar)')
      .single();

    if (error) {
      console.error('[POST /api/approvals] db error:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Activity log (best-effort)
    void db.from('activities').insert({
      type:        'approval_created',
      description: `Approval created with status "${status}"`,
      user_id:     auth.profile.id,
      user_uuid:   auth.profile.id,
      client_id:   clientId || null,
      entity_type: 'approval',
      entity_id:   data?.id ?? null,
    }).then(({ error: actErr }) => {
      if (actErr) console.warn('[POST /api/approvals] activity log failed:', actErr.message);
    });

    // Notification (best-effort)
    if (data) {
      void notifyApprovalRequested({
        approvalId: data.id,
        taskId:     taskId || null,
        taskTitle:  null,
        reviewerId: reviewerId || auth.profile.id,
        clientId:   clientId || null,
      });
    }

    return NextResponse.json({ success: true, approval: data }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/approvals] unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
